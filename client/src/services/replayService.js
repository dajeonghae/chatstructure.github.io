import axios from "axios";
import { parseConversationHistory } from "../utils/parseConversationHistory";
import { store } from "../redux/store";
import {
  addOrUpdateNode,
  setParentNode,
} from "../redux/slices/nodeSlice";

export const replayConversation = async (text, currentNodeId, contextMode) => {
  const replayMessages = parseConversationHistory(text);
  const dispatch = store.dispatch;  // ✅ dispatch 내부에서 확보
  const allMessages = [];

  console.log("replayConversation 실행됨");

  // ✅ role 기반 메시지를 짝지어 구성
  const replayPairs = [];
  for (let i = 0; i < replayMessages.length; i += 2) {
    const user = replayMessages[i]?.content || "";
    const assistant = replayMessages[i + 1]?.content || "";
    replayPairs.push({ user, assistant });
  }

  for (let i = 0; i < replayPairs.length; i++) {
    const { user, assistant } = replayPairs[i];
    const state = store.getState();
    const filteredNodes = state.node.nodes;

    console.log(`🔁 Turn ${i}:`);

    try {
      const parentNode = await axios.post("http://localhost:8080/api/update-graph", {
        nodes: filteredNodes,
        userMessage: user,
        gptMessage: assistant,
      });

      const { keyword, parentNodeId, relation } = parentNode.data;
      const existingNodeId = Object.keys(filteredNodes).find(
        (nodeId) => filteredNodes[nodeId].keyword === keyword
      );

      if (existingNodeId) {
        dispatch(
          addOrUpdateNode({
            id: existingNodeId,
            keyword,
            userMessage: user,
            gptMessage: assistant,
            contextMode,
          })
        );

        allMessages.push(
          {
            role: "user",
            content: user,
            nodeId: existingNodeId,
            number: allMessages.length + 1,
          },
          {
            role: "assistant",
            content: assistant,
            nodeId: existingNodeId,
            number: allMessages.length + 2,
          }
        );

        continue;
      }

      const generateNodeId = (parentNodeId, nodes) => {
        const childIds = nodes[parentNodeId]?.children || [];
        let maxSuffix = 0;
        childIds.forEach((childId) => {
          const suffix = parseInt(childId.split("-").pop(), 10);
          if (!isNaN(suffix)) {
            maxSuffix = Math.max(maxSuffix, suffix);
          }
        });
        return `${parentNodeId}-${maxSuffix + 1}`;
      };

      const updatedNodes = store.getState().node.nodes;
      const newNodeId = generateNodeId(parentNodeId, updatedNodes);

      dispatch(
        addOrUpdateNode({
          id: newNodeId,
          keyword,
          userMessage: user,
          gptMessage: assistant,
          contextMode,
        })
      );

      if (parentNodeId && updatedNodes[parentNodeId]) {
        dispatch(setParentNode({ nodeId: newNodeId, parentId: parentNodeId, relation }));
      }

      allMessages.push(
        {
          role: "user",
          content: user,
          nodeId: newNodeId,
          number: allMessages.length + 1,
        },
        {
          role: "assistant",
          content: assistant,
          nodeId: newNodeId,
          number: allMessages.length + 2,
        }
      );
    } catch (error) {
      console.error(`❌ [Turn ${i}] 에러 발생:`, error);
    }
  }

  return allMessages;
};
