import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { sendMessageToApi } from "../../services/chatbotService.js";
import { setCurrentScrolledDialog, clearActiveSelections, toggleActiveNode } from "../../redux/slices/nodeSlice.js";
import { parseConversationHistory } from "../../utils/parseConversationHistory.js";
import {
  buildFullSnapshot,
  downloadSnapshotFile,
  loadSnapshotThunk,
} from "../../utils/snapshotManager.js";
import { store } from "../../redux/store.js";
import axios from "axios";
import DialogPair from "../../components/textBox/DialogPair.jsx";
import ChatIndex from "./ChatIndex.jsx";
import ChatInput from "../../components/textBox/ChatInput.jsx";

// rawSegments에서 canMerge 조건 만족하는 연속 항목을 하나의 segment로 합침
const mergeSegments = (rawSegments, canMerge) => {
  if (!rawSegments.length) return [];
  const segments = [];
  let group = { ...rawSegments[0] };
  for (let i = 1; i < rawSegments.length; i++) {
    if (canMerge(rawSegments[i - 1], rawSegments[i])) {
      group.bottomPercent = rawSegments[i].bottomPercent;
    } else {
      segments.push(group);
      group = { ...rawSegments[i] };
    }
  }
  segments.push(group);
  return segments;
};

const LayoutWrapper = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
`;

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  height: 100%;
  position: relative;
  padding: 20px 30px 70px 120px;
  box-sizing: border-box;
`;

const MessagesContainer = styled.div`
  flex: 1;
  width: 100%;
  overflow-y: auto;
  scrollbar-width: none;
`;

const TopButtonContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 100;
`;

const NavPill = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  border: 1.5px solid #E8EAED;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 4px 16px rgba(0,0,0,0.03);
  position: absolute;
  right: -25px;
  bottom: 64px;
  z-index: 200;
`;

const NavButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: ${(p) => (p.disabled ? "default" : "pointer")};
  filter: ${(p) => (p.disabled ? "saturate(0)" : "none")};
  opacity: ${(p) => (p.disabled ? 0.35 : 1)};
  pointer-events: ${(p) => (p.disabled ? "none" : "auto")};
  transition: background 0.15s ease, filter 0.2s ease, opacity 0.2s ease;
  &:hover { background: ${(p) => (p.disabled ? "transparent" : "#F3F4F6")}; }
`;

const SaveButton = styled.button`
  padding: 8px 12px;
  background-color: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
`;

const ExportButton = styled(SaveButton)`
  background-color: #2d3748;
`;

const ImportButton = styled(SaveButton)`
  background-color: #ffffff;
  color: #2d3748;
  border: 1px solid #2d3748;
`;

function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);
  const [topicMarkers, setTopicMarkers] = useState([]);
  const [graphNodeSegments, setGraphNodeSegments] = useState([]);
  const [graphNodeColor, setGraphNodeColor] = useState("#A5A7AA");
  const [graphTopicNodeId, setGraphTopicNodeId] = useState(null);
  const [allTopicsHighlighted, setAllTopicsHighlighted] = useState(false);

  const scrollContainerRef = useRef(null);
  const contentScaleRef = useRef({ min: 0, max: 100 });
  const messagesEndRef = useRef(null);
  const messageRefs = useRef([]);
  const fileInputRef = useRef(null);
  const prevActiveDialogNumbersRef = useRef([]);
  const textareaRef = useRef(null);

  const dispatch = useDispatch();

  const activeDialogNumbers = useSelector((state) => state.node.activeDialogNumbers);
  const currentScrolledDialog = useSelector((state) => state.node.currentScrolledDialog);
  const activeNodeIds = useSelector((state) => state.node.activeNodeIds);
  const nodes = useSelector((state) => state.node.nodes);
  const nodeColors = useSelector((state) => state.node.nodeColors);
  const contextMode = useSelector((state) => state.mode.contextMode);
  const selectedIndexNodeId = useSelector((state) => state.node.selectedIndexNodeId);

  const currentNodeId = activeNodeIds[activeNodeIds.length - 1] || "root";

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight } = e.target;

    const percent = (scrollTop / scrollHeight) * 100;
    setScrollPercent(percent);
  };

  const scrollToMessage = (index) => {
    const el = messageRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const getAllDescendantDialogs = (startNodeId) => {
    const result = new Set();
    const queue = [startNodeId];
    while (queue.length) {
      const nodeId = queue.shift();
      const n = nodes[nodeId];
      if (!n) continue;
      Object.keys(n.dialog || {}).map(Number).forEach((d) => result.add(d));
      (n.children || []).forEach((childId) => queue.push(childId));
    }
    return [...result];
  };

  const calculateTopicMarkers = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const topicNodes = Object.values(nodes).filter(
      (node) => node.parent === "root" && node.id !== "root"
    );

    const totalScrollableHeight = Math.max(1, container.scrollHeight);

    const containerRect = container.getBoundingClientRect();

    // 토픽별 dialog 소유 맵 (다른 토픽이 중간에 있는지 확인용)
    const dialogTopicMap = {};
    topicNodes.forEach((tn) => {
      getAllDescendantDialogs(tn.id).forEach((d) => {
        if (!dialogTopicMap[d]) dialogTopicMap[d] = [];
        dialogTopicMap[d].push(tn.id);
      });
    });

    const markers = topicNodes
      .map((node) => {
        const dialogNumbers = getAllDescendantDialogs(node.id);
        if (dialogNumbers.length === 0) return null;

        const sorted = [...dialogNumbers].sort((a, b) => a - b);
        const firstDialogNumber = sorted[0];
        const userMessageIndex = (firstDialogNumber - 1) * 2;
        const targetEl = messageRefs.current[userMessageIndex];

        if (!targetEl) return null;

        const targetRect = targetEl.getBoundingClientRect();
        const topPx = targetRect.top - containerRect.top + container.scrollTop;
        const topPercent = Math.max(
          0,
          Math.min(100, (topPx / totalScrollableHeight) * 100)
        );

        // 각 dialog의 위치 계산
        const rawSegments = sorted
          .map((num) => {
            const msgIndex = (num - 1) * 2;
            const userEl = messageRefs.current[msgIndex];
            if (!userEl) return null;
            const aiEl = messageRefs.current[msgIndex + 1];

            const userRect = userEl.getBoundingClientRect();
            const topPxSeg = userRect.top - containerRect.top + container.scrollTop;

            const bottomEl = aiEl || userEl;
            const bottomRect = bottomEl.getBoundingClientRect();
            const bottomPxSeg = bottomRect.bottom - containerRect.top + container.scrollTop;

            return {
              dialogNum: num,
              topPercent: Math.max(0, Math.min(100, (topPxSeg / totalScrollableHeight) * 100)),
              bottomPercent: Math.max(0, Math.min(100, (bottomPxSeg / totalScrollableHeight) * 100)),
              messageIndex: msgIndex,
            };
          })
          .filter(Boolean);

        // 사이에 다른 토픽 없으면 병합
        const segments = mergeSegments(rawSegments, (prev, curr) => {
          for (let d = prev.dialogNum + 1; d < curr.dialogNum; d++) {
            if ((dialogTopicMap[d] || []).some((t) => t !== node.id)) return false;
          }
          return true;
        });

        return {
          nodeId: node.id,
          keyword: node.keyword,
          color: nodeColors[node.id] || "#A5A7AA",
          topPercent,
          messageIndex: userMessageIndex,
          segments,
        };
      })
      .filter(Boolean);

    // 실제 비율 간격은 유지하면서 전체를 0%~100%로 늘려 트랙에 꽉 채움
    const allPercents = markers.flatMap((m) => [
      m.topPercent,
      ...m.segments.flatMap((s) => [s.topPercent, s.bottomPercent ?? s.topPercent]),
    ]);
    const minP = markers.length > 0 ? Math.min(...allPercents) : 0;
    const maxP = markers.length > 0 ? Math.max(...allPercents) : 100;
    const range = maxP - minP || 1;
    contentScaleRef.current = { min: minP, max: maxP, range };
    const scale = (v) => ((v - minP) / range) * 100;

    setTopicMarkers(markers.map((m) => ({
      ...m,
      topPercent: scale(m.topPercent),
      segments: m.segments.map((s) => ({
        ...s,
        topPercent: scale(s.topPercent),
        bottomPercent: s.bottomPercent != null ? scale(s.bottomPercent) : undefined,
      })),
    })));
  };

  const handleMarkerClick = (nodeId, messageIndex) => {
    const queue = [nodeId];
    while (queue.length) {
      const id = queue.shift();
      const n = nodes[id];
      if (!n) continue;
      dispatch(toggleActiveNode(id));
      (n.children || []).forEach((c) => queue.push(c));
    }
    scrollToMessage(messageIndex);
  };

  const computeSegmentsForDialogs = (dialogNumbers, container) => {
    const totalScrollableHeight = Math.max(1, container.scrollHeight);
    const containerRect = container.getBoundingClientRect();
    const { min, range } = contentScaleRef.current;
    const scale = (v) => ((v - min) / (range || 1)) * 100;
    return dialogNumbers
      .map((num) => {
        const msgIndex = (num - 1) * 2;
        const userEl = messageRefs.current[msgIndex];
        if (!userEl) return null;
        const aiEl = messageRefs.current[msgIndex + 1];
        const userRect = userEl.getBoundingClientRect();
        const topPxSeg = userRect.top - containerRect.top + container.scrollTop;
        const bottomEl = aiEl || userEl;
        const bottomRect = bottomEl.getBoundingClientRect();
        const bottomPxSeg = bottomRect.bottom - containerRect.top + container.scrollTop;
        const rawTop = (topPxSeg / totalScrollableHeight) * 100;
        const rawBottom = (bottomPxSeg / totalScrollableHeight) * 100;
        return {
          dialogNum: num,
          topPercent: Math.max(0, Math.min(100, scale(rawTop))),
          bottomPercent: Math.max(0, Math.min(100, scale(rawBottom))),
          messageIndex: msgIndex,
        };
      })
      .filter(Boolean);
  };

  // contextMode OFF 시 활성화된 선택 초기화
  const prevContextModeRef = useRef(false);
  const justClearedRef = useRef(false);
  useEffect(() => {
    if (prevContextModeRef.current && !contextMode) {
      justClearedRef.current = true;
      setGraphNodeSegments([]);
      setGraphTopicNodeId(null);
      setAllTopicsHighlighted(false);
      dispatch(clearActiveSelections());
    }
    prevContextModeRef.current = contextMode;
  }, [contextMode, dispatch]);

  // 활성화된 노드 → ChatIndex highlight + 스크롤 (모든 모드 통합)
  useEffect(() => {
    // contextMode 해제 직후엔 stale activeNodeIds로 재계산하지 않음
    if (justClearedRef.current) {
      justClearedRef.current = false;
      return;
    }
    if (contextMode) return;
    if (selectedIndexNodeId) {
      setGraphNodeSegments([]);
      setGraphTopicNodeId(null);
      setAllTopicsHighlighted(false);
      return;
    }
    if (activeNodeIds.length === 0) {
      setGraphNodeSegments([]);
      setGraphTopicNodeId(null);
      setAllTopicsHighlighted(false);
      return;
    }

    // root 클릭 → 모든 topic highlight (ChatIndex가 markers 직접 사용)
    if (activeNodeIds.includes("root")) {
      setGraphNodeSegments([]);
      setGraphTopicNodeId(null);
      setAllTopicsHighlighted(true);
      return;
    }

    setAllTopicsHighlighted(false);
    const container = scrollContainerRef.current;
    if (!container) return;

    const allDialogNumbers = [];
    activeNodeIds.forEach((nodeId) => {
      const node = nodes[nodeId];
      if (!node) return;
      Object.keys(node.dialog || {}).map(Number).forEach((d) => allDialogNumbers.push(d));
    });
    allDialogNumbers.sort((a, b) => a - b);

    const ownedSet = new Set(allDialogNumbers);
    const raw = computeSegmentsForDialogs(allDialogNumbers, container);
    const segs = mergeSegments(raw, (prev, curr) => {
      for (let d = prev.dialogNum + 1; d < curr.dialogNum; d++) {
        if (!ownedSet.has(d)) return false;
      }
      return true;
    });
    setGraphNodeSegments(segs);

    let cur = nodes[activeNodeIds[0]];
    while (cur && cur.parent && cur.parent !== "root") cur = nodes[cur.parent];
    setGraphNodeColor((cur?.id && nodeColors[cur.id]) || "#A5A7AA");
    setGraphTopicNodeId(cur?.id || null);
  }, [activeNodeIds, nodes, messages, contextMode, selectedIndexNodeId]);

  useEffect(() => {
    const prevDialogs = prevActiveDialogNumbersRef.current;
    const currDialogs = activeDialogNumbers;

    const prevSorted = [...prevDialogs].sort((a, b) => a - b);
    const currSorted = [...currDialogs].sort((a, b) => a - b);

    const newlyAdded = currSorted.filter((num) => !prevSorted.includes(num));
    const newlyRemoved = prevSorted.filter((num) => !currSorted.includes(num));

    if (newlyAdded.length > 0 && currSorted.length > 0) {
      if (contextMode) {
        // 새 메시지 추가(context mode) → 최신 대화로 스크롤
        const latest = currSorted[currSorted.length - 1];
        dispatch(setCurrentScrolledDialog(latest));
        setTimeout(() => scrollToMessage(latest - 1), 0);
      } else {
        // 인덱스/노드 등으로 history 활성화 → 가장 이른 대화로 스크롤
        const earliest = currSorted[0];
        dispatch(setCurrentScrolledDialog(earliest));
        setTimeout(() => scrollToMessage(earliest - 1), 0);
      }
    } else if (newlyRemoved.length > 0 && currSorted.length > 0) {
      const closest = currSorted.reduce((prev, curr) => {
        return Math.abs(curr - currentScrolledDialog) < Math.abs(prev - currentScrolledDialog)
          ? curr
          : prev;
      }, currSorted[0]);

      dispatch(setCurrentScrolledDialog(closest));
    }

    prevActiveDialogNumbersRef.current = currDialogs;
  }, [activeDialogNumbers, currentScrolledDialog, dispatch, contextMode]);

  useEffect(() => {
    scrollToBottom();
    setTimeout(() => {
      calculateTopicMarkers();
      setScrollPercent(100);
    }, 100);
  }, [messages]);

  useLayoutEffect(() => {
    calculateTopicMarkers();
  }, [messages, nodes, nodeColors]);

  useEffect(() => {
    const handleResize = () => {
      calculateTopicMarkers();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [messages, nodes, nodeColors]);

  const moveToMessage = (direction) => {
    const sortedDialogs = [...activeDialogNumbers].sort((a, b) => a - b);
    const currentScrolled = store.getState().node.currentScrolledDialog;
    const currentDialogIndex = sortedDialogs.indexOf(currentScrolled);
    const nextIndex = currentDialogIndex + direction;

    if (nextIndex >= 0 && nextIndex < sortedDialogs.length) {
      const nextMessageNumber = sortedDialogs[nextIndex];
      dispatch(setCurrentScrolledDialog(nextMessageNumber));
      scrollToMessage(nextMessageNumber - 1);
    }
  };

  const handleExportSnapshot = () => {
    const reduxState = store.getState();
    const snapshot = buildFullSnapshot(reduxState, messages);
    downloadSnapshotFile(snapshot);
  };

  const handleImportSnapshot = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const { messages: restored } = await dispatch(loadSnapshotThunk(file));
      setMessages(restored || []);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        calculateTopicMarkers();
      }, 0);

      alert("📦 스냅샷 복원 완료!(JSON)");
    } catch (err) {
      console.error(err);
      alert("❌ 스냅샷 불러오기 실패 (콘솔 확인)");
    }
  };

  const handleSend = async () => {
    if (input.trim() === "" || isLoading) return;

    setIsLoading(true);

    const userMessage = {
      role: "user",
      content: input,
      nodeId: currentNodeId,
      number: messages.length + 1,
    };

    let updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    setInput("");
    setIsExpanded(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }

    try {
      const gptMessageContent = await dispatch(sendMessageToApi(input, updatedMessages));
      const gptMessage = {
        role: "assistant",
        content: gptMessageContent,
        nodeId: currentNodeId,
        number: updatedMessages.length + 1,
      };

      updatedMessages = [...updatedMessages, gptMessage];
      setMessages(updatedMessages);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (e.shiftKey) return;
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const onReplay = async (e) => {
      const raw = e?.detail?.text ?? "";
      if (!raw.trim()) return;

      const parsed = parseConversationHistory(raw);

      const pairs = [];
      for (let i = 0; i < parsed.length; i += 2) {
        const user = parsed[i]?.content ?? "";
        const assistant = parsed[i + 1]?.content ?? "";
        if (user) pairs.push({ user, assistant });
      }

      let running = [...messages];

      window.dispatchEvent(new CustomEvent("vis:start"));
      try {
        for (const { user, assistant } of pairs) {
          const userMessage = {
            role: "user",
            content: user,
            nodeId: currentNodeId,
            number: running.length + 1,
          };

          running = [...running, userMessage];
          setMessages(running);

          try {
            const gptMessageContent = await dispatch(
              sendMessageToApi(user, running, { assistantOverride: assistant })
            );

            const gptMessage = {
              role: "assistant",
              content: gptMessageContent,
              nodeId: currentNodeId,
              number: running.length + 1,
            };

            running = [...running, gptMessage];
            setMessages(running);
          } catch (err) {
            console.error("Replay turn failed:", err);
          }
        }
      } finally {
        window.dispatchEvent(new CustomEvent("vis:done"));
      }
    };

    window.addEventListener("chat:replay", onReplay);
    return () => window.removeEventListener("chat:replay", onReplay);
  }, [dispatch, currentNodeId, messages]);

  const handleLoadFromServer = async () => {
    try {
      const r = await axios.get("http://localhost:8080/api/chatgraph/get");
      const snap = r.data?.snapshot;
      if (!snap) throw new Error("no snapshot returned");

      const { messages: restored } = await dispatch(loadSnapshotThunk(snap));
      setMessages(restored || []);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        calculateTopicMarkers();
      }, 0);

      alert("♻️ 서버에서 스냅샷 불러오기 완료 (chatgraph.json)");
    } catch (e) {
      console.error(e);
      alert("❌ 서버 불러오기 실패 (콘솔 확인)");
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);

    e.target.style.height = "40px";
    const currentScrollHeight = e.target.scrollHeight;

    if (currentScrollHeight > 45) {
      setIsExpanded(true);
      e.target.style.height = `${currentScrollHeight}px`;
    } else {
      setIsExpanded(false);
      e.target.style.height = "40px";
    }
  };

  return (
    <LayoutWrapper>
      <ChatContainer>
        <MessagesContainer ref={scrollContainerRef} onScroll={handleScroll}>
          {(() => {
            const pairedMessages = [];

            for (let i = 0; i < messages.length; i += 2) {
              pairedMessages.push({
                userMsg: messages[i],
                aiMsg: messages[i + 1],
                userIndex: i,
                aiIndex: i + 1,
              });
            }

            return pairedMessages.map((pair, index) => (
              <DialogPair
                key={index}
                userMsg={pair.userMsg}
                aiMsg={pair.aiMsg}
                userRef={(el) => {
                  messageRefs.current[pair.userIndex] = el;
                }}
                aiRef={(el) => {
                  if (pair.aiMsg) {
                    messageRefs.current[pair.aiIndex] = el;
                  }
                }}
              />
            ));
          })()}
          <div ref={messagesEndRef} />
        </MessagesContainer>

        <TopButtonContainer>
          <ExportButton onClick={handleExportSnapshot}>Export</ExportButton>
          <ImportButton onClick={handleLoadFromServer}>Import</ImportButton>
          <input
            type="file"
            ref={fileInputRef}
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleImportSnapshot}
          />
        </TopButtonContainer>

        {(() => {
          const sorted = [...activeDialogNumbers].sort((a, b) => a - b);
          const currentIndex = sorted.indexOf(currentScrolledDialog);
          const inactive = sorted.length === 0;
          return (
            <NavPill>
              <NavButton onClick={() => moveToMessage(-1)} disabled={inactive || currentIndex <= 0}>
                <span className="material-symbols-outlined md-black-font md-18" style={{ userSelect: "none" }}>keyboard_arrow_up</span>
              </NavButton>
              <NavButton onClick={() => moveToMessage(1)} disabled={inactive || currentIndex >= sorted.length - 1}>
                <span className="material-symbols-outlined md-black-font md-18" style={{ userSelect: "none" }}>keyboard_arrow_down</span>
              </NavButton>
            </NavPill>
          );
        })()}
        <ChatInput
          input={input}
          isLoading={isLoading}
          isExpanded={isExpanded}
          textareaRef={textareaRef}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onSend={handleSend}
        />
      </ChatContainer>

      <ChatIndex
        scrollPercent={scrollPercent}
        markers={topicMarkers}
        graphNodeSegments={graphNodeSegments}
        graphNodeColor={graphNodeColor}
        graphTopicNodeId={graphTopicNodeId}
        allTopicsHighlighted={allTopicsHighlighted}
        onMarkerClick={handleMarkerClick}
      />
    </LayoutWrapper>
  );
}

export default Chatbot;