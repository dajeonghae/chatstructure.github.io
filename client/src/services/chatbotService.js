import axios from "axios";
import { addOrUpdateNode, setParentNode, applyEmbeddingUpdate, setNodeKeywords } from "../redux/slices/nodeSlice";

const buildNodeTextForLabel = (node, takePairs = 3) => {
  if (!node || !node.dialog) return "";
  const entries = Object.entries(node.dialog)
    .map(([n, v]) => [Number(n), v])
    .sort((a, b) => a[0] - b[0]);

  const last = entries.slice(-takePairs);
  return last.map(([n, { userMessage, gptMessage }]) =>
    `Q${n}: ${userMessage}\nA${n}: ${gptMessage}`
  ).join("\n\n");
};

// 비동기로 /api/label-node 호출 → 완료되면 Redux에 setNodeKeywords 디스패치
const triggerKeywordLabeling = (dispatch, nodeId, nodes) => {
  try {
    const node = nodes[nodeId];
    if (!node) return;
    const text = buildNodeTextForLabel(node, 3); // 최근 3쌍 사용
    if (!text) return;

    const existing = Array.isArray(node.keywords) ? node.keywords : [];

    // 👉 "fire-and-forget": await 하지 않음 (UI 지연 없음)
    axios.post("http://localhost:8080/api/label-node", { text, existing })
      .then((r) => {
        const { keywords } = r.data || {};
        if (Array.isArray(keywords) && keywords.length) {
          console.log("✅ 라벨링 결과:", keywords);
          dispatch(setNodeKeywords({ id: nodeId, keywords }));
        }
      })
      .catch((err) => {
        console.warn("label-node 실패(무시 가능):", err?.message || err);
      });
  } catch (e) {
    console.warn("triggerKeywordLabeling 예외(무시 가능):", e?.message || e);
  }
};

// 🟢 API 요청을 처리하는 함수
export const sendMessageToApi = (input, previousMessages, opts = {}) => async (dispatch, getState) => {
  const files = opts.files || [];
  try {
    const contextNodeIds = getState().node.contextNodeIds;
    const contextDialogNumbers = getState().node.contextDialogNumbers;
    const allNodes = getState().node.nodes;
    const hasContextSelection = contextNodeIds.length > 0;

    // 🔥 Context 노드가 선택된 경우 해당 대화만 필터링
    let filteredMessages = previousMessages;
    if (hasContextSelection) {
      filteredMessages = previousMessages.filter((msg, index) => contextDialogNumbers.includes(index + 1));
      console.log("🔥 Context 선택 - 활성 대화 필터링:", filteredMessages);
    }

    // 🔥 Context 노드가 선택된 경우 해당 노드만 필터링
    const filteredNodes = hasContextSelection
      ? Object.fromEntries(Object.entries(allNodes).filter(([id]) => contextNodeIds.includes(id)))
      : allNodes;

    console.log("🔥 Context 선택 - 활성 노드 필터링:", filteredNodes);

    // [+] A. 파이프라인 완전 우회 (스냅샷/리플레이 고정 재현용)
    if (opts.skipPipeline) { // [+]
      const gptResponse = String(opts.assistantOverride ?? ""); // [+]
      return gptResponse; // [+] 그래프/임베딩 갱신 생략
    } // [+]


    // 🔹 Step 1: 어시스턴트 응답 확보
    // [CHANGED] 리플레이(주입) 지원: opts.assistantOverride가 있으면 /api/chat 호출 생략
    let gptResponse;
    if (Object.prototype.hasOwnProperty.call(opts, "assistantOverride")) { // [CHANGED]
      gptResponse = opts.assistantOverride ?? "";                           // [CHANGED]
      console.log("📌 GPT 응답(override 사용):", { gptResponse });          // [CHANGED]
    } else {
      // 기존 경로: /api/chat 호출하여 GPT 응답 받기 (원본 유지)
      const response = await axios.post("http://localhost:8080/api/chat", {
        message: input,
        history: filteredMessages,
        files: files.map((f) => ({ name: f.name, type: f.type, data: f.data })),
      });
      const chatData = response.data;
      gptResponse = chatData?.message;
      console.log("📌 GPT 응답:", { gptResponse });

      if (chatData?.skipEmbedding) {
        console.log("서버 신호에 따라 임베딩 및 그래프 업데이트를 건너뜁니다.");
        return { content: gptResponse, isSpecialResponse: true }; // gptResponse만 반환하고 모든 작업을 끝냅니다.
      }
    }

    // 🔹 Step 2: Embedding + 후보/판정 (nodes 함께 전달)
    //  - override 여부와 무관하게 정상 파이프라인을 태워서 그래프/센트로이드/통계 갱신
    const embRes = await axios.post("http://localhost:8080/api/embedding", {
      userMessage: input,
      gptMessage: gptResponse,
      nodes: filteredNodes
    });
    const { embedding, top3, decision, attachNodeId, updatedNode } = embRes.data;

    // 🔹 Step 3
    // 3-a) 편입이면 해당 노드에 바로 추가 + 센트로이드/통계 갱신
    if (decision === "attach" && attachNodeId && filteredNodes[attachNodeId]) {
      dispatch(addOrUpdateNode({
        id: attachNodeId,
        keyword: filteredNodes[attachNodeId].keyword,
        userMessage: input,
        gptMessage: gptResponse,
      }));
      if (updatedNode) {
        dispatch(applyEmbeddingUpdate({
          id: updatedNode.id,
          newCentroid: updatedNode.newCentroid,
          newCount: updatedNode.newCount,
          newSimStats: updatedNode.newSimStats
        }));
      }

      triggerKeywordLabeling(dispatch, attachNodeId, getState().node.nodes);
      return gptResponse;
    }

    // 3-b) 새 노드인 경우: LLM으로 라벨/부모/관계 정리(top3도 전달)
    const parentNode = await axios.post("http://localhost:8080/api/update-graph", {
      nodes: filteredNodes,
      userMessage: input,
      gptMessage: gptResponse,
      top3
    });
    const { keyword, parentNodeId, relation } = parentNode.data;

    // 동일 키워드 재사용 체크 (선택)
    const existingNodeId = Object.keys(filteredNodes).find(
      (nodeId) => filteredNodes[nodeId].keyword === keyword
    );
    if (existingNodeId) {
      dispatch(addOrUpdateNode({
        id: existingNodeId,
        keyword,
        userMessage: input,
        gptMessage: gptResponse,
      }));

      triggerKeywordLabeling(dispatch, existingNodeId, getState().node.nodes);
      return gptResponse;
    }

    // 새 노드 ID 생성
    const generateNodeId = (parentNodeId, nodes) => {
      const childIds = nodes[parentNodeId]?.children || [];
      let maxSuffix = 0;
      childIds.forEach((childId) => {
        const suffix = parseInt(childId.split("-").pop(), 10);
        if (!isNaN(suffix)) maxSuffix = Math.max(maxSuffix, suffix);
      });
      return `${parentNodeId}-${maxSuffix + 1}`;
    };

    const updatedNodes = getState().node.nodes;
    const parent = (parentNodeId && updatedNodes[parentNodeId]) ? parentNodeId : "root";
    const newNodeId = generateNodeId(parent, updatedNodes);

    // ✅ 새 노드 생성: centroid/count/simStats 초기화
    dispatch(addOrUpdateNode({
      id: newNodeId,
      keyword,
      userMessage: input,
      gptMessage: gptResponse,
      centroid: embedding,
      count: 1,
      simStats: { n: 0, mean: 0, m2: 0, std: 0 },
    }));

    if (parent && updatedNodes[parent]) {
      dispatch(setParentNode({ nodeId: newNodeId, parentId: parent, relation }));
    }

    triggerKeywordLabeling(dispatch, newNodeId, getState().node.nodes);
    return gptResponse;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};
