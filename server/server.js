// === Embedding & Similarity utils ===
const EMBEDDING_MODEL = "text-embedding-3-small";

// ✨ 1. 튜닝 파라미터 변수 복원 및 최상단 배치
const DEFAULT_THRESHOLD = 0.72;
const THRESHOLD_FLOOR   = 0.65;
const TOP2_MARGIN       = 0.05;
const K_STD             = 0.25;

// ✨ 2. 유틸리티 함수들을 변수 선언 다음에 배치하여 ReferenceError 해결
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function adaptiveThreshold(simStats) {
  if (!simStats || !Number.isFinite(simStats.mean) || !Number.isFinite(simStats.std) || simStats.n < 3) {
    return DEFAULT_THRESHOLD;
  }
  const t = simStats.mean - K_STD * simStats.std;
  return Math.max(THRESHOLD_FLOOR, t);
}

function welfordUpdate(stats, x) {
  let n = (stats?.n) | 0;
  let mean = stats?.mean || 0;
  let m2 = stats?.m2 || 0;
  n += 1;
  const delta = x - mean;
  mean += delta / n;
  const delta2 = x - mean;
  m2 += delta * delta2;
  const variance = n > 1 ? (m2 / (n - 1)) : 0;
  return { n, mean, m2, std: Math.sqrt(variance) };
}

function extractAssistantText(resp) {
  try {
    if (typeof resp?.output_text === 'string' && resp.output_text.trim()) {
      return resp.output_text.trim();
    }
    if (Array.isArray(resp?.output)) {
      for (const item of resp.output) {
        if (item?.type === 'message') {
          const parts = item.content || [];
          for (const p of parts) {
            const t = p?.text ?? p?.content ?? p?.value;
            if (typeof t === 'string' && t.trim()) return t.trim();
          }
        }
        if (item?.type === 'function_call' && typeof item?.arguments === 'string' && item.arguments.trim()) {
          return item.arguments.trim();
        }
        if (item?.type === 'custom_tool_call' && typeof item?.input === 'string' && item.input.trim()) {
          return item.input.trim();
        }
      }
    }
    const msg = resp?.choices?.[0]?.message;
    if (typeof msg?.content === 'string' && msg.content.trim()) {
      return msg.content.trim();
    }
    if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length) {
      const args = msg.tool_calls[0]?.function?.arguments;
      if (typeof args === 'string' && args.trim()) return args.trim();
    }
    if (msg?.function_call?.arguments) {
      const s = String(msg.function_call.arguments).trim();
      if (s) return s;
    }
  } catch {}
  return '';
}

function safeParseJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch {}
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i !== -1 && j !== -1 && j > i) {
    try { return JSON.parse(s.slice(i, j + 1)); } catch {}
  }
  return null;
}


require('dotenv').config();
const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const fs = require('fs');
const cors = require('cors');
const { encoding_for_model } = require("@dqbd/tiktoken");
const enc = encoding_for_model("gpt-3.5-turbo");
const app = express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
const FIXED_SNAPSHOT_PATH = path.join(__dirname, "chatgraph.json");

// 정적 파일 (옵션)
app.use(express.static(path.join(__dirname, 'public')));

// ====== 스냅샷 저장 폴더 세팅 ======
const SNAPSHOT_DIR = path.join(__dirname, "snapshots");
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}
function tsName(base = "chatgraph-snapshot") {
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  return `${base}-${stamp}.json`;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.static(path.join(__dirname, 'public')));

async function retryRequest(callback, maxRetries = 5) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      const response = await callback();
      const text = extractAssistantText(response);
      if (!text) {
        throw new Error("GPT 응답이 비어 있음 - 재시도");
      }
      return response;
    } catch (error) {
      attempts++;
      console.error(`❌ 재시도 중... (${attempts}/${maxRetries}) - 오류: ${error.message}`);
      if (attempts >= maxRetries) throw error;
    }
  }
}

const MAX_TOKENS = 15900;
const RESERVED_FOR_RESPONSE = 4096;
const MAX_CONTEXT_TOKENS = MAX_TOKENS - RESERVED_FOR_RESPONSE;

const countTokens = (messages) => {
  if (!Array.isArray(messages)) return 0;
  let tokens = 0;
  for (const message of messages) {
    tokens += 4;
    const content = typeof message.content === 'string' ? message.content : "";
    tokens += enc.encode(content || "").length;
    if (message.name) tokens -= 1;
  }
  tokens += 2;
  return tokens;
};

let summaryText = ""; // 누적 요약 저장

app.post('/api/chat', async (req, res) => {
    const userPrompt = req.body.message;
    const previousMessages = req.body.history || [];
    const files = req.body.files || [];

    const imageFiles = files.filter(f => f.type && f.type.startsWith('image/'));
    const pdfFiles   = files.filter(f => f.type === 'application/pdf');

    // ===== PDF 있을 때: Responses API (PDF 네이티브 지원, 이미지 혼합 가능) =====
    if (pdfFiles.length > 0) {
        const userContentItems = [{ type: "input_text", text: userPrompt || "" }];

        for (const file of imageFiles) {
            console.log(`🖼️ 이미지 첨부 (Responses): ${file.name}`);
            userContentItems.push({
                type: "input_image",
                image_url: `data:${file.type};base64,${file.data}`,
                detail: "auto"
            });
        }
        for (const file of pdfFiles) {
            console.log(`📄 PDF 첨부: ${file.name}`);
            userContentItems.push({
                type: "input_file",
                filename: file.name,
                file_data: `data:application/pdf;base64,${file.data}`
            });
        }

        const historyInput = previousMessages.map(msg => ({
            role: msg.role,
            content: msg.content || ''
        }));

        try {
            const response = await retryRequest(() =>
                openai.responses.create({
                    model: "gpt-5.1",
                    input: [
                        { role: "system", content: "사용자의 질문에 대한 답변을 해줘" },
                        ...historyInput,
                        { role: "user", content: userContentItems }
                    ],
                    max_output_tokens: RESERVED_FOR_RESPONSE,
                })
            );
            const gptResponse = extractAssistantText(response);
            console.log("📌 GPT 응답 (Responses API):", gptResponse?.slice(0, 80));
            return res.json({ message: gptResponse });
        } catch (error) {
            console.error("❌ Responses API 오류:", error);
            return res.status(500).send("Internal Server Error");
        }
    }

    // ===== 이미지만 있을 때: Chat Completions (vision, image_url) =====
    if (imageFiles.length > 0) {
        const userContent = [
            { type: "text", text: userPrompt || "" },
            ...imageFiles.map(f => ({
                type: "image_url",
                image_url: { url: `data:${f.type};base64,${f.data}`, detail: "auto" }
            }))
        ];
        imageFiles.forEach(f => console.log(`🖼️ 이미지 첨부 (Chat Completions): ${f.name}`));

        try {
            const response = await retryRequest(() =>
                openai.responses.create({
                    model: "gpt-5.1",
                    input: [
                        { role: "system", content: "사용자의 질문에 대한 답변을 해줘" },
                        ...previousMessages.map(({ role, content }) => ({ role, content })),
                        { role: "user", content: userContent }
                    ],
                    max_output_tokens: RESERVED_FOR_RESPONSE,
                })
            );
            const gptResponse = extractAssistantText(response);
            console.log("📌 GPT 응답 (이미지 vision):", gptResponse?.slice(0, 80));
            return res.json({ message: gptResponse });
        } catch (error) {
            console.error("❌ Chat Completions (vision) 오류:", error);
            return res.status(500).send("Internal Server Error");
        }
    }

    // ===== 파일 없을 때: 기존 Chat Completions 로직 =====

    // --- 🚑 시나리오 2: 새 메시지가 너무 긴 경우 ---
    const userPromptTokens = countTokens([{ role: "user", content: userPrompt }]);
    if (userPromptTokens > MAX_CONTEXT_TOKENS) {
        console.log(`⚠️ 새 메시지(${userPromptTokens})가 너무 길어 처리를 중단하고 미리 정의된 답변을 반환합니다.`);
        const tooLongMessage = "입력하신 내용이 너무 길어 답변할 수 없습니다. 내용을 줄여서 다시 질문해 주세요.";
        return res.json({ message: tooLongMessage, skipEmbedding: true });
    }

    // --- 🚑 시나리오 1: 일반 대화 중 토큰이 초과되는 경우 ---
    let finalMessages = [
        { role: "system", content: "사용자의 질문에 대한 답변을 해줘" },
        ...previousMessages,
        { role: "user", content: userPrompt },
    ];

    const totalTokens = countTokens(finalMessages);
    console.log("💡 전체 메시지 토큰 수:", totalTokens);

    if (totalTokens > MAX_CONTEXT_TOKENS) {
        console.log("⚠️ 토큰 초과 감지, 과거 대화 요약을 시작합니다...");

        let keptMessages = [...previousMessages];
        let removedMessages = [];

        while (
            keptMessages.length > 0 &&
            countTokens([
                { role: "system", content: "사용자의 질문에 대한 답변을 해줘" },
                ...(summaryText ? [{ role: "assistant", content: `이전 대화 요약: ${summaryText}` }] : []),
                ...keptMessages,
                { role: "user", content: userPrompt },
            ]) > MAX_CONTEXT_TOKENS
        ) {
            removedMessages.unshift(keptMessages.shift());
        }

        if (removedMessages.length > 0) {
            let toSummarize = [
                ...(summaryText ? [{ role: "assistant", content: `기존 요약: ${summaryText}` }] : []),
                ...removedMessages,
            ];

        const SUMMARY_MODEL_MAX_TOKENS = 16000;
        let summaryTokens = countTokens(toSummarize);

        if (summaryTokens > SUMMARY_MODEL_MAX_TOKENS) {
            console.log(`⚠️ 요약할 내용(${summaryTokens})조차 너무 깁니다. 최신 내용만 남기고 잘라냅니다.`);
            let truncatedToSummarize = [];
            let currentSummaryTokens = 0;
            for (let i = toSummarize.length - 1; i >= 0; i--) {
                const message = toSummarize[i];
                const messageTokens = countTokens([message]);
                if (currentSummaryTokens + messageTokens < SUMMARY_MODEL_MAX_TOKENS) {
                    truncatedToSummarize.unshift(message);
                    currentSummaryTokens += messageTokens;
                } else {
                    break;
                }
            }
            toSummarize = truncatedToSummarize;
            summaryText = "";
        }

            try {
                const summaryResponse = await retryRequest(() =>
                    openai.chat.completions.create({
                        model: "gpt-3.5-turbo",
                        messages: [
                            { role: "system", content: "다음 대화 내용을 이전 요약과 함께, 대화의 핵심 맥락이 유지되도록 간결하고 명확하게 요약해줘." },
                            ...toSummarize,
                        ],
                        max_completion_tokens: 500,
                    })
                );
                summaryText = extractAssistantText(summaryResponse) || summaryText;
                console.log("📌 이전 대화 요약 업데이트:", summaryText);
            } catch (error) {
                console.error("❌ 이전 대화 요약 실패:", error);
            }
        }

        finalMessages = [
            { role: "system", content: "사용자의 질문에 대한 답변을 해줘" },
            ...(summaryText ? [{ role: "assistant", content: `이전 대화 요약: ${summaryText}` }] : []),
            ...keptMessages,
            { role: "user", content: userPrompt },
        ];
    }

    const finalTokenCount = countTokens(finalMessages);
    console.log("📦 최종 메시지 토큰 수:", finalTokenCount);
    console.log("📉 응답을 위한 남은 토큰:", MAX_TOKENS - finalTokenCount);

    try {
        const response = await retryRequest(() =>
            openai.responses.create({
                model: "gpt-5.1",
                input: finalMessages.map(({ role, content }) => ({ role, content })),
                max_output_tokens: RESERVED_FOR_RESPONSE,
            })
        );
        const gptResponse = extractAssistantText(response);
        res.json({ message: gptResponse });
    } catch (error) {
        console.error("❌ GPT 응답 오류:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.post('/api/embedding', async (req, res) => {
  const { userMessage, gptMessage, nodes = {} } = req.body;

  const text = `[User] ${userMessage}\n[Assistant] ${gptMessage}`;
  try {
    let inputForEmbedding = text;
    const MAX_EMBEDDING_TOKENS = 8191; 
    const tokenArray = enc.encode(inputForEmbedding);

    if (tokenArray.length > MAX_EMBEDDING_TOKENS) {
      console.log(`⚠️ 임베딩 입력이 너무 깁니다(${tokenArray.length} 토큰). 최대치(${MAX_EMBEDDING_TOKENS})로 잘라냅니다.`);
      const truncatedTokenArray = tokenArray.slice(0, MAX_EMBEDDING_TOKENS);
      inputForEmbedding = Buffer.from(enc.decode(truncatedTokenArray)).toString('utf-8');
    }

    const embResp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: inputForEmbedding
    });
    const convVec = embResp.data[0].embedding;

    const candidates = Object.values(nodes)
      .filter(n => Array.isArray(n.centroid) && n.centroid.length > 0)
      .map(n => {
        const sim = cosineSimilarity(convVec, n.centroid);
        const passThreshold = adaptiveThreshold(n.simStats);
        const count = n.count ?? (n.dialog ? Object.keys(n.dialog).length : 0);
        return {
          id: n.id,
          keyword: n.keyword,
          similarity: Number(sim.toFixed(6)),
          passThreshold: Number(passThreshold.toFixed(6)),
          passed: sim >= passThreshold,
          count,
          simStats: n.simStats || null
        };
      })
      .sort((a, b) => b.similarity - a.similarity);

    const top3 = candidates.slice(0, 3);
    const top1 = top3[0];
    const top2 = top3[1];

    let decision = 'new_node';
    let attachNodeId = null;

    if (top1 && top1.id !== 'root') {
      const margin = top1.similarity - (top2?.similarity ?? 0);
      if (top1.passed && margin >= TOP2_MARGIN) {
        decision = 'attach';
        attachNodeId = top1.id;
      }
    }

    let updatedNode = null;
    if (decision === 'attach') {
      const node = nodes[attachNodeId];
      const count = (node.count ?? (node.dialog ? Object.keys(node.dialog).length : 0)) || 0;

      if (Array.isArray(node.centroid) && node.centroid.length === convVec.length) {
        const newCentroid = node.centroid.map((v, i) => (v * count + convVec[i]) / (count + 1));
        const newSimStats = welfordUpdate(node.simStats || { n: 0, mean: 0, m2: 0 }, top1.similarity);

        updatedNode = {
          id: attachNodeId,
          newCentroid,
          newCount: count + 1,
          newSimStats
        };
      }
    }

    res.json({
      embedding: convVec,
      top3,
      decision,
      attachNodeId,
      updatedNode
    });
  } catch (e) {
    console.error('❌ /api/embedding error', e);
    res.status(500).json({ error: 'Embedding failed' });
  }
});


app.post('/api/update-graph', async (req, res) => {
  const { nodes, userMessage, gptMessage, top3 = [] } = req.body;
  const safeNodes = nodes || {};
  const existingKeywords = Object.values(safeNodes).map(node => node.keyword);

  const simplifiedNodes = Object.fromEntries(
    Object.entries(safeNodes).map(([id, node]) => [id, { id, keyword: node.keyword }])
  );

  try {
    const response = await retryRequest(() => openai.responses.create({
      model: 'gpt-5.1',
      input: [
        {
          role: 'system',
          content: `
            너는 그래프 라벨러다. 아래 정보를 보고 "새 노드"일 때만 라벨/부모/관계를 정리한다.
            - keyword는 무조건 직관적으로 이해하기 쉬운 간단하고 짧은 단어로 설정해라.
            - Top-3 후보(유사도/통과여부 포함)를 부모 선택 참고자료로 사용하라.
            - parentNodeId는 Top-3 중에서 고르되, 적절치 않으면 현재 그래프 상태를 보고 존재하는 키워드 중에서 선택하라.

            반드시 이 JSON 스키마로 답하라:
            \`\`\`json
            {
              "keyword": "추출된 키워드",
              "parentNodeId": "부모 노드 ID 또는 null",
              "relation": "부모와의 관계(한 단어 또는 짧은 구)"
            }
            \`\`\`
          `
        },
        { role: 'user', content: `최근 대화 요약 후보: ${JSON.stringify({ userMessage, gptMessage })}` },
        { role: 'user', content: `Top-3 후보 노드: ${JSON.stringify(top3)}` },
        { role: 'user', content: `현재 그래프 상태(간략): ${JSON.stringify(simplifiedNodes)}` },
        { role: 'user', content: `현재 존재하는 키워드: ${JSON.stringify(existingKeywords)}` }
      ],
      max_output_tokens: 600,
      text: { format: { type: "json_object" } }
    }));

    const raw = extractAssistantText(response);
    if (!raw) throw new Error("LLM returned empty text");
    const parsed = safeParseJson(raw) || {};

    let keyword = (parsed.keyword ?? "").trim() || "???";
    let parentNodeId = parsed.parentNodeId === null ? null : (parsed.parentNodeId ?? "").trim();
    let relation = (parsed.relation ?? "").trim() || "관련";

    if (parentNodeId && !Object.keys(safeNodes).includes(parentNodeId)) {
      parentNodeId = Object.keys(safeNodes).find(key => keyword.includes(safeNodes[key].keyword)) || "root";
    }

    res.json({ keyword, parentNodeId, relation });
  } catch (error) {
    console.error("❌ Error in Graph Update:", error?.response?.data || error.message || error);
    res.status(500).json({ error: "서버 내부 오류 발생" });
  }
});

app.post('/api/label-node', async (req, res) => {
  const { text, existing = [] } = req.body;

  // --- 유틸: 응답을 튼튼하게 파싱 ---
  const sanitize = (s) => {
    if (!s) return "";
    // 코드펜스 제거
    s = s.replace(/```(?:json)?/gi, '```');
    s = s.replace(/```/g, '').trim();
    return s;
  };

  const tryParseKeywords = (raw) => {
    const cleaned = sanitize(raw);

    // 1) 배열 그대로 오는 경우
    if (cleaned.trim().startsWith('[')) {
      try {
        const arr = JSON.parse(cleaned);
        if (Array.isArray(arr)) return arr;
      } catch {}
    }

    // 2) 객체로 오는 경우 { "keywords": [...] }
    if (cleaned.trim().startsWith('{')) {
      try {
        const obj = JSON.parse(cleaned);
        if (obj && Array.isArray(obj.keywords)) return obj.keywords;
      } catch {}
    }

    // 3) 텍스트에 배열만 섞여 있는 경우: 첫 번째 [ ... ] 추출
    const match = cleaned.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) return arr;
      } catch {}
    }

    // 4) 마지막 방어: 쉼표 기준 단어 추출
    const fallback = cleaned
      .split(/[\n,]/)
      .map(s => s.replace(/["'\[\]{}]/g, '').trim())
      .filter(Boolean);
    return fallback;
  };

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content:
          `다음 대화를 보고 '짧은 한국어 키워드' 3개만 뽑아 **JSON 배열**로만 답해.
           - 해시태그/기호 금지, 1~3단어.
           - 기존 키워드와 겹치면 다른 표현.
           - 설명/문장/코드펜스 없이, 오직 JSON 배열만!
           예: ["RSA 암호", "공개키", "토션트"]`
        },
        { role: "user", content: `기존 키워드: ${JSON.stringify(existing)}` },
        { role: "user", content: `대화:\n${text}` },
      ],
      max_completion_tokens: 120,
      // ❌ response_format 제거 (배열 강제와 충돌)
    });

    const raw = resp.choices?.[0]?.message?.content ?? "";
    let arr = tryParseKeywords(raw);

    // 문자열로만 & 공백 제거
    let keywords = (Array.isArray(arr) ? arr : [])
      .map(x => String(x).trim())
      .filter(Boolean);

    // 중복/동의어 대충 제거(소문자 기준) + 최대 3개
    const seen = new Set();
    keywords = keywords.filter(k => {
      const key = k.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);

    if (!keywords.length) {
      return res.status(422).json({ error: "no keywords parsed", raw });
    }

    return res.json({ keywords });
  } catch (e) {
    console.error("❌ /api/label-node error", e?.response?.data || e.message || e);
    return res.status(500).json({ error: "labeling failed" });
  }
});

// 저장: body = { name?: string, snapshot: object }
app.post("/api/snapshots/save", (req, res) => {
  try {
    const { name, snapshot } = req.body || {};
    if (!snapshot || typeof snapshot !== "object") {
      return res.status(400).json({ error: "snapshot(object) is required" });
    }
    const filename = (name && name.endsWith(".json") ? name : (name ? `${name}.json` : tsName()));
    const filePath = path.join(SNAPSHOT_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
    return res.json({ ok: true, filename });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "save failed" });
  }
});

// 목록: 최신순
app.get("/api/snapshots/list", (req, res) => {
  try {
    const files = fs.readdirSync(SNAPSHOT_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const stat = fs.statSync(path.join(SNAPSHOT_DIR, f));
        return { name: f, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a,b)=> b.mtime - a.mtime);
    res.json({ files });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "list failed" });
  }
});

// 가져오기: /api/snapshots/get?filename=xxx.json
app.get("/api/snapshots/get", (req, res) => {
  try {
    const { filename } = req.query;
    if (!filename) return res.status(400).json({ error: "filename is required" });
    const filePath = path.join(SNAPSHOT_DIR, path.basename(filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "not found" });
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json({ snapshot: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "get failed" });
  }
});

app.post("/api/chatgraph/save", (req, res) => {
  try {
    const { snapshot } = req.body || {};
    if (!snapshot || typeof snapshot !== "object") {
      return res.status(400).json({ error: "snapshot(object) is required" });
    }
    fs.writeFileSync(FIXED_SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");
    return res.json({ ok: true, filename: "chatgraph.json" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "save failed" });
  }
});

app.get("/api/chatgraph/get", (req, res) => {
  try {
    if (!fs.existsSync(FIXED_SNAPSHOT_PATH)) {
      return res.status(404).json({ error: "not found" });
    }
    const data = JSON.parse(fs.readFileSync(FIXED_SNAPSHOT_PATH, "utf-8"));
    return res.json({ snapshot: data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "get failed" });
  }
});

app.listen(8080, function () {
  console.log('🚀 Server is listening on port 8080');
});