import axios from "axios";
import { addOrUpdateNode, setParentNode, applyEmbeddingUpdate } from "../redux/slices/nodeSlice";

// 🟢 API 요청을 처리하는 함수
export const sendMessageToApi = (input, previousMessages) => async (dispatch, getState) => {
  try {
    const contextMode = getState().mode.contextMode;
    const activeDialogNumbers = getState().node.activeDialogNumbers;
    const allNodes = getState().node.nodes;
    const activeNodeIds = getState().node.activeNodeIds;

    // 🔥 Context Mode 활성화 시 활성 대화만 필터링
    let filteredMessages = previousMessages;
    if (contextMode) {
      filteredMessages = previousMessages.filter((msg, index) => activeDialogNumbers.includes(index + 1));
      console.log("🔥 Context Mode 활성화 - 활성 대화 필터링:", filteredMessages);
    }

    // 🔥 Context Mode 활성화 시 활성 노드만 필터링
    const filteredNodes = contextMode
      ? Object.fromEntries(Object.entries(allNodes).filter(([id]) => activeNodeIds.includes(id)))
      : allNodes;

    console.log("🔥 Context Mode 활성화 - 활성 노드 필터링:", filteredNodes);

    // 🔹 Step 1: /api/chat 호출하여 GPT 응답 받기
    const response = await axios.post("http://localhost:8080/api/chat", {
      message: input,
      history: filteredMessages,
    });

    const { message: gptResponse } = response.data;
    console.log("📌 GPT 응답:", { gptResponse });


    // 2) Embedding + 후보/판정 (nodes 함께 전달)
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
        contextMode
      }));
      if (updatedNode) {
        dispatch(applyEmbeddingUpdate({
          id: updatedNode.id,
          newCentroid: updatedNode.newCentroid,
          newCount: updatedNode.newCount,
          newSimStats: updatedNode.newSimStats
        }));
      }
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
          contextMode,
        }));
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
        contextMode,
      centroid: embedding,
      count: 1,
      simStats: { n: 0, mean: 0, m2: 0, std: 0 }
      }));

      if (parent && updatedNodes[parent]) {
        dispatch(setParentNode({ nodeId: newNodeId, parentId: parent, relation }));
      }

      return gptResponse;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  };
