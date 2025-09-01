// === Embedding & Similarity utils ===
const EMBEDDING_MODEL = "text-embedding-3-small";

// 튜닝 파라미터(원하면 바꿔 사용)
const DEFAULT_THRESHOLD = 0.72;   // 노드별 통계가 충분치 않을 때 기본 통과 기준
const THRESHOLD_FLOOR   = 0.65;   // 임계치 하한
const TOP2_MARGIN       = 0.05;   // Top-1 과 Top-2 최소 차이(주제전환 아님 판정에 필요)
const K_STD             = 0.25;   // 적응 임계치: mean - K*std

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

// 러닝 평균/분산(Welford)
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

/** ---------------- LLM output helpers ---------------- */
// Chat Completions + Responses API 모두 커버
function extractAssistantText(resp) {
  try {
    // 1) Responses API 최우선: output_text가 있으면 그대로 사용
    if (typeof resp?.output_text === 'string' && resp.output_text.trim()) {
      return resp.output_text.trim();
    }

    // 2) Responses API: output 배열 검사
    if (Array.isArray(resp?.output)) {
      // message 아이템 텍스트
      for (const item of resp.output) {
        if (item?.type === 'message') {
          // content가 배열일 수 있음
          const parts = item.content || [];
          for (const p of parts) {
            const t = p?.text ?? p?.content ?? p?.value;
            if (typeof t === 'string' && t.trim()) return t.trim();
          }
        }
        // function_call 아이템 arguments
        if (item?.type === 'function_call' && typeof item?.arguments === 'string' && item.arguments.trim()) {
          return item.arguments.trim();
        }
        // custom_tool_call 입력
        if (item?.type === 'custom_tool_call' && typeof item?.input === 'string' && item.input.trim()) {
          return item.input.trim();
        }
      }
    }

    // 3) Chat Completions: content
    const msg = resp?.choices?.[0]?.message;
    if (typeof msg?.content === 'string' && msg.content.trim()) {
      return msg.content.trim();
    }
    // 4) Chat Completions: tool_calls.function.arguments
    if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length) {
      const args = msg.tool_calls[0]?.function?.arguments;
      if (typeof args === 'string' && args.trim()) return args.trim();
    }
    // 5) Chat Completions: function_call.arguments (구버전 호환)
    if (msg?.function_call?.arguments) {
      const s = String(msg.function_call.arguments).trim();
      if (s) return s;
    }
  } catch {
    // ignore
  }
  return '';
}

// 코드블록/앞뒤 텍스트 섞여도 { ... } JSON만 안전 파싱
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
const cors = require('cors'); 
const { encoding_for_model } = require("@dqbd/tiktoken");
const enc = encoding_for_model("gpt-3.5-turbo");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.static(path.join(__dirname, 'public')));

// 🟢 재시도 함수 - (툴콜까지 포함해) 비어있지 않은 응답만 통과
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
const RESERVED_FOR_RESPONSE = 1200;
const MAX_CONTEXT_TOKENS = MAX_TOKENS - RESERVED_FOR_RESPONSE;

const countTokens = (messages) => {
  let tokens = 0;
  for (const message of messages) {
    tokens += 4; // role, structure overhead
    tokens += enc.encode(message.content || "").length;
    if (message.name) tokens -= 1; // name 사용 시 1토큰 줄어듦
  }
  tokens += 2; // assistant reply priming
  return tokens;
};

let summaryText = ""; // 누적 요약 저장

app.post('/api/chat', async (req, res) => {
  const userPrompt = req.body.message;
  const previousMessages = req.body.history || [];

  // 1. 전체 메시지 기반 메시지 구성
  let finalMessages = [
    { role: "system", content: "사용자의 질문에 대한 답변을 해줘" },
    ...previousMessages,
    { role: "user", content: userPrompt },
  ];

  let totalTokens = countTokens(finalMessages);
  console.log("💡 전체 메시지 토큰 수:", totalTokens);

  if (totalTokens > MAX_CONTEXT_TOKENS) {
    console.log("⚠️ 토큰 초과 감지, 요약 시작...");

    // 2. 요약을 위한 messages 정리
    let keptMessages = [...previousMessages];
    let removedMessages = [];

    while (
      countTokens([
        { role: "system", content: "사용자의 질문에 대한 답변을 해줘" },
        ...(summaryText ? [{ role: "assistant", content: `이전 대화 요약: ${summaryText}` }] : []),
        ...keptMessages,
        { role: "user", content: userPrompt },
      ]) > MAX_CONTEXT_TOKENS - 300
    ) {
      removedMessages.push(keptMessages.shift());
    }

    // 3. 요약 수행
    const toSummarize = [
      ...(summaryText ? [{ role: "assistant", content: summaryText }] : []),
      ...removedMessages,
    ];

    try {
      const summaryResponse = await retryRequest(() =>
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "다음 대화를 이전 요약과 함께 간결하고 명확하게, 토큰 한도를 넘기지 않도록 요약해줘." },
            ...toSummarize,
          ],
          max_tokens: 300,
        })
      );
      summaryText = summaryResponse.choices[0]?.message?.content?.trim() || summaryText;
      console.log("📌 누적 요약 업데이트:", summaryText);
    } catch (error) {
      console.error("❌ 요약 실패:", error);
    }

    // 4. 최종 메시지 구성
    finalMessages = [
      { role: "system", content: "사용자의 질문에 대한 답변을 해줘" },
      ...(summaryText ? [{ role: "assistant", content: `이전 대화 요약: ${summaryText}` }] : []),
      ...keptMessages,
      { role: "user", content: userPrompt },
    ];
  }

  // 5. 최종 메시지 토큰 수 확인
  const finalTokenCount = countTokens(finalMessages);
  console.log("📦 최종 메시지 토큰 수:", finalTokenCount);
  console.log("📉 응답을 위한 남은 토큰:", MAX_TOKENS - finalTokenCount);

  // 6. GPT 응답 호출
  try {
    const response = await retryRequest(() =>
      openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: finalMessages,
        max_tokens: RESERVED_FOR_RESPONSE,
      })
    );

    const gptResponse = response.choices[0].message.content;
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
    const embResp = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text
    });
    const convVec = embResp.data[0].embedding;

    // 후보 생성(centroid 있는 노드만)
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

    // 편입 시, 새 센트로이드/통계 계산해 함께 반환(프론트에서 즉시 반영)
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


// server.js — /api/update-graph 라우트 전체 교체
app.post('/api/update-graph', async (req, res) => {  
  const { nodes, userMessage, gptMessage, top3 = [] } = req.body;  
  const safeNodes = nodes || {};
  const existingKeywords = Object.values(safeNodes).map(node => node.keyword);

  const simplifiedNodes = Object.fromEntries(
    Object.entries(safeNodes).map(([id, node]) => [id, { id, keyword: node.keyword }])
  );

  try {
    const response = await retryRequest(() => openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `
            너는 그래프 라벨러다. 아래 정보를 보고 "새 노드"일 때만 라벨/부모/관계를 정리한다.
            - Top-3 후보(유사도/통과여부 포함)를 부모 선택 참고자료로 사용하라.
            - parentNodeId는 Top-3 중에서 고르되, 적절치 않으면 "null"을 반환한다.

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
      max_completion_tokens: 600,
      response_format: { type: "json_object" }
    }));

    const raw = extractAssistantText(response);
    if (!raw) throw new Error("LLM returned empty text");
    const parsed = safeParseJson(raw) || {};

    let keyword = (parsed.keyword ?? "").trim() || "???";
    let parentNodeId = parsed.parentNodeId === null ? null : (parsed.parentNodeId ?? "").trim();
    let relation = (parsed.relation ?? "").trim() || "관련";

    // parentNodeId 유효성 보정
    if (parentNodeId && !Object.keys(safeNodes).includes(parentNodeId)) {
      parentNodeId = Object.keys(safeNodes).find(key => keyword.includes(safeNodes[key].keyword)) || "root";
    }

    res.json({ keyword, parentNodeId, relation });
  } catch (error) {
    console.error("❌ Error in Graph Update:", error?.response?.data || error.message || error);
    res.status(500).json({ error: "서버 내부 오류 발생" });
  }
});


app.listen(8080, function () {
  console.log('🚀 Server is listening on port 8080');
});
