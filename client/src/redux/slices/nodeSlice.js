import { createSlice, createAction } from "@reduxjs/toolkit";

// ✅ [변경 2] nodeColors 세팅용 액션 생성
export const setNodeColors = createAction("node/setNodeColors");

const defaultInitialState = {
  nodes: {
    root: {
      id: "root",
      keyword: "Root",
      centroid: null,
      count: 0,
      simStats: null,
      parent: null,
      relation: null,
      children: [],
      dialog: {
        0: { userMessage: "Root", gptMessage: "Root Node" }
      },
      keywords: [],
      createdAt: 0,
    },
  },
  activeNodeIds: [],
  activeDialogNumbers: [],
  contextNodeIds: [],
  contextDialogNumbers: [],
  dialogCount: 1,
  currentScrolledDialog: null,
  selectedIndexNodeId: null,
  selectedGraphNodeId: null,
  nodeColors: {},
};

const nodeSlice = createSlice({
  name: "node",
  initialState: defaultInitialState,

  reducers: {
    toggleActiveDialog: (state, action) => {
      const dialogNumber = action.payload;
    
      // 사용자 질문인지 확인 (홀수만 처리)
      if (dialogNumber % 2 === 0) return; // 짝수면 (GPT 응답), 무시
    
      const questionNumber = dialogNumber;
      const answerNumber = dialogNumber + 1;
    
      const isQuestionActive = state.activeDialogNumbers.includes(questionNumber);
      const isAnswerActive = state.activeDialogNumbers.includes(answerNumber);
    
      const isPairActive = isQuestionActive && isAnswerActive;
    
      if (isPairActive) {
        // 둘 다 비활성화
        state.activeDialogNumbers = state.activeDialogNumbers.filter(
          (n) => n !== questionNumber && n !== answerNumber
        );
      } else {
        // 둘 다 추가
        state.activeDialogNumbers.push(questionNumber);
        state.activeDialogNumbers.push(answerNumber);
      }
    
      // 🔁 노드 활성화 상태 재계산
      const newActiveNodeIds = new Set();
      Object.entries(state.nodes).forEach(([nodeId, node]) => {
        const dialogNumbers = Object.keys(node.dialog).map(Number);
        const hasActive = dialogNumbers.some((dn) => {
          const q = (dn - 1) * 2 + 1;
          const a = (dn - 1) * 2 + 2;
          return state.activeDialogNumbers.includes(q) || state.activeDialogNumbers.includes(a);
        });
    
        if (hasActive) {
          newActiveNodeIds.add(nodeId);
        }
      });
    
      state.activeNodeIds = [...newActiveNodeIds];
    },
    
    toggleActiveNode: (state, action) => {
      const nodeIds = Array.isArray(action.payload) ? action.payload : [action.payload];
    
      nodeIds.forEach((nodeId) => {
        // 이미 활성화된 노드라면 비활성화 처리
        if (state.activeNodeIds.includes(nodeId)) {
          state.activeNodeIds = state.activeNodeIds.filter(id => id !== nodeId);
    
          // 비활성화 처리: 해당 노드의 대화 번호 삭제
          const dialogNumbers = Object.keys(state.nodes[nodeId].dialog).map(Number);
          const newActiveDialogs = state.activeDialogNumbers.filter(number => {
            return !dialogNumbers.some(dialogNumber => {
              const questionNumber = (dialogNumber - 1) * 2 + 1;
              const answerNumber = (dialogNumber - 1) * 2 + 2;
              return number === questionNumber || number === answerNumber;
            });
          });
          state.activeDialogNumbers = newActiveDialogs;
    
          return;
        }
    
        // 활성화된 노드와 대화 번호 추가
        state.activeNodeIds.push(nodeId);
    
        let activeDialogs = [];
        if (state.nodes[nodeId]) {
          const dialogNumbers = Object.keys(state.nodes[nodeId].dialog).map(Number);
    
          // 질문-답변 쌍으로 활성화 목록 만들기
          dialogNumbers.forEach((number) => {
            activeDialogs.push((number - 1) * 2 + 1);  // 질문 번호 추가
            activeDialogs.push((number - 1) * 2 + 2);  // 답변 번호 추가
          });
    
          // 중복 제거하여 활성화 목록 갱신
          const uniqueDialogs = Array.from(new Set([...state.activeDialogNumbers, ...activeDialogs]));

          // 🔥 오름차순 정렬
          uniqueDialogs.sort((a, b) => a - b);
          state.activeDialogNumbers = uniqueDialogs;

          // 🔥 가장 최근 대화로 스크롤되도록 설정
          const latestDialogNumber = uniqueDialogs[uniqueDialogs.length - 1];
          state.currentScrolledDialog = latestDialogNumber;
        }

        // 🔁 activeNodeIds 다시 계산
        const newActiveNodeIds = new Set();
        Object.entries(state.nodes).forEach(([nodeId, node]) => {
          const dialogNumbers = Object.keys(node.dialog).map(Number);
          const hasActive = dialogNumbers.some((dn) => {
            const q = (dn - 1) * 2 + 1;
            const a = (dn - 1) * 2 + 2;
            return state.activeDialogNumbers.includes(q) || state.activeDialogNumbers.includes(a);
          });
          if (hasActive) newActiveNodeIds.add(nodeId);
        });
        state.activeNodeIds = [...newActiveNodeIds];

        console.log("🔥 활성화된 노드 목록:", JSON.stringify(state.activeNodeIds));
      });
    },

    toggleContextNode: (state, action) => {
      const nodeId = action.payload;

      if (state.contextNodeIds.includes(nodeId)) {
        state.contextNodeIds = state.contextNodeIds.filter(id => id !== nodeId);
        const dialogNumbers = Object.keys(state.nodes[nodeId].dialog).map(Number);
        state.contextDialogNumbers = state.contextDialogNumbers.filter(number => {
          return !dialogNumbers.some(dialogNumber => {
            const questionNumber = (dialogNumber - 1) * 2 + 1;
            const answerNumber = (dialogNumber - 1) * 2 + 2;
            return number === questionNumber || number === answerNumber;
          });
        });
        return;
      }

      state.contextNodeIds.push(nodeId);

      if (state.nodes[nodeId]) {
        const dialogNumbers = Object.keys(state.nodes[nodeId].dialog).map(Number);
        const newDialogs = [];
        dialogNumbers.forEach((number) => {
          newDialogs.push((number - 1) * 2 + 1);
          newDialogs.push((number - 1) * 2 + 2);
        });
        const unique = Array.from(new Set([...state.contextDialogNumbers, ...newDialogs]));
        unique.sort((a, b) => a - b);
        state.contextDialogNumbers = unique;
      }

      console.log("🔥 Context 노드 활성화:", JSON.stringify(state.contextNodeIds));
    },

    addOrUpdateNode: (state, action) => {
        const {
          id, keyword, userMessage, gptMessage,
          centroid, count, simStats
        } = action.payload;

      if (!state.nodes[id]) {
        // const parent  = parentNodeId || "root";

        state.nodes[id] = {
          id,
          keyword,
          // parent,
          // relation: "관련",
          children: [],
          dialog: {},
          centroid: centroid ?? null,
          count: Number.isFinite(count) ? count : 0,
          simStats: simStats ?? null,
          parent: state.nodes[id]?.parent ?? undefined,
          relation: state.nodes[id]?.relation ?? undefined,
          dialog: {},
          createdAt: Date.now(),
          keywords: [],
        };
        
        // if (state.nodes[parent]            // 안전 체크
        //     && !state.nodes[parent].children.includes(id)) {
        //   state.nodes[parent].children.push(id);
        // }
      }

      const dialogNumber = state.dialogCount;
      state.nodes[id].dialog[dialogNumber] = {
        userMessage,
        gptMessage,
      };

      // 대화 번호 증가
      state.dialogCount += 1;

      console.log("대화 번호 증가됨:",state.dialogCount);
    },

    setParentNode: (state, action) => {
      const { nodeId, parentId, relation } = action.payload;
      if (state.nodes[nodeId] && state.nodes[parentId]) {
        state.nodes[nodeId].parent = parentId;
        state.nodes[nodeId].relation = relation;
      if (!state.nodes[parentId].children.includes(nodeId)) {
         state.nodes[parentId].children.push(nodeId);
       }
      }
    },

    setNodeKeywords: (state, action) => {
      const { id, keywords } = action.payload;
      if (!state.nodes[id]) return;
      state.nodes[id].keywords = keywords;
    },

   // ✅ 편입(attach) 시 서버가 계산해 준 새 센트로이드/통계를 반영
   applyEmbeddingUpdate: (state, action) => {
     const { id, newCentroid, newCount, newSimStats } = action.payload;
     if (!state.nodes[id]) return;
     if (Array.isArray(newCentroid)) state.nodes[id].centroid = newCentroid;
     if (Number.isFinite(newCount)) state.nodes[id].count = newCount;
     if (newSimStats) state.nodes[id].simStats = newSimStats;
   },

    // 🔥 현재 스크롤된 대화 번호 설정 액션 추가
    setCurrentScrolledDialog: (state, action) => {
      state.currentScrolledDialog = action.payload;
    },

    setSelectedIndexNode: (state, action) => {
      state.selectedIndexNodeId = action.payload;
      state.selectedGraphNodeId = null;
    },

    setSelectedGraphNode: (state, action) => {
      state.selectedGraphNodeId = action.payload;
      state.selectedIndexNodeId = null;
    },

    clearActiveSelections: (state) => {
      state.activeNodeIds = [];
      state.activeDialogNumbers = [];
      state.contextNodeIds = [];
      state.contextDialogNumbers = [];
      state.currentScrolledDialog = null;
      state.selectedIndexNodeId = null;
      state.selectedGraphNodeId = null;
    },

    removeLastDialog: (state) => {
      const lastDialogNumber = state.dialogCount - 1;
      if (lastDialogNumber < 1) return;

      for (const nodeId of Object.keys(state.nodes)) {
        if (nodeId === 'root') continue;
        const node = state.nodes[nodeId];
        if (node.dialog[lastDialogNumber] !== undefined) {
          delete node.dialog[lastDialogNumber];
          state.dialogCount -= 1;

          if (Object.keys(node.dialog).length === 0) {
            const parentId = node.parent;
            if (parentId && state.nodes[parentId]) {
              state.nodes[parentId].children = state.nodes[parentId].children.filter(id => id !== nodeId);
            }
            delete state.nodes[nodeId];
          }

          const q = (lastDialogNumber - 1) * 2 + 1;
          const a = (lastDialogNumber - 1) * 2 + 2;
          state.activeDialogNumbers = state.activeDialogNumbers.filter(n => n !== q && n !== a);
          state.contextDialogNumbers = state.contextDialogNumbers.filter(n => n !== q && n !== a);
          state.contextNodeIds = state.contextNodeIds.filter(id => state.nodes[id]);

          const newActiveNodeIds = new Set();
          Object.entries(state.nodes).forEach(([id, n]) => {
            const dNums = Object.keys(n.dialog).map(Number);
            const hasActive = dNums.some(dn => {
              const qn = (dn - 1) * 2 + 1;
              const an = (dn - 1) * 2 + 2;
              return state.activeDialogNumbers.includes(qn) || state.activeDialogNumbers.includes(an);
            });
            if (hasActive) newActiveNodeIds.add(id);
          });
          state.activeNodeIds = [...newActiveNodeIds];
          break;
        }
      }
    },

    resetToInitial: () => defaultInitialState,

    resetState: (state, action) => {
      const { nodes, activeNodeIds, activeDialogNumbers, contextNodeIds, contextDialogNumbers, dialogCount, currentScrolledDialog, nodeColors } = action.payload;
      state.nodes = nodes || state.nodes;
      state.activeNodeIds = activeNodeIds;
      state.activeDialogNumbers = activeDialogNumbers;
      state.contextNodeIds = contextNodeIds || [];
      state.contextDialogNumbers = contextDialogNumbers || [];
      state.dialogCount = Number.isInteger(dialogCount) ? dialogCount : 1;
      if (typeof currentScrolledDialog !== "undefined") {
        state.currentScrolledDialog = currentScrolledDialog;
      }
      if (typeof nodeColors !== "undefined") {
        state.nodeColors = nodeColors;
      }
    }
  },

  extraReducers: (builder) => {
    builder.addCase(setNodeColors, (state, action) => {
      state.nodeColors = action.payload;
    });
  },
});

export const { toggleActiveDialog, toggleActiveNode, toggleContextNode, addOrUpdateNode, setParentNode, applyEmbeddingUpdate, setCurrentScrolledDialog, setSelectedIndexNode, setSelectedGraphNode, resetState, resetToInitial, setNodeKeywords, clearActiveSelections, removeLastDialog } = nodeSlice.actions;
export default nodeSlice.reducer;
