import { configureStore } from "@reduxjs/toolkit";
import nodeReducer from "./slices/nodeSlice";
import modeReducer from "./slices/modeSlice";

const loadNodeState = () => {
  try {
    const saved = localStorage.getItem('experiment_node_state');
    if (!saved) return undefined;
    const parsed = JSON.parse(saved);
    return {
      node: {
        ...parsed,
        activeNodeIds: [],
        activeDialogNumbers: [],
        contextNodeIds: [],
        contextDialogNumbers: [],
        currentScrolledDialog: null,
        selectedIndexNodeId: null,
        selectedGraphNodeId: null,
      },
    };
  } catch {
    return undefined;
  }
};

export const store = configureStore({
  reducer: {
    node: nodeReducer,
    mode: modeReducer,
  },
  preloadedState: loadNodeState(),
});

store.subscribe(() => {
  try {
    localStorage.setItem('experiment_node_state', JSON.stringify(store.getState().node));
  } catch {}
});
