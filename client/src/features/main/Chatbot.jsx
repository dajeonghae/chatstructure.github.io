import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { sendMessageToApi } from "../../services/chatbotService.js";
import { setCurrentScrolledDialog } from "../../redux/slices/nodeSlice.js";
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
`;

const MessagesContainer = styled.div`
  flex: 1;
  width: 93%;
  padding: 20px;
  overflow-y: auto;
  scrollbar-width: none;
  margin-bottom: 2px;
`;

const InputContainer = styled.div`
  z-index: 100;
  display: flex;
  width: 87%;
  min-height: 40px;
  max-height: 120px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 8px 8px 8px 20px;

  border-radius: ${(props) => (props.$isExpanded ? "30px" : "100px")};
  transition: border-radius 0.2s ease-in-out;

  border: 1px solid rgba(240, 240, 240);
  background-color: #ffffff;
  box-shadow: 0px 8px 24px rgba(149, 157, 165, 0.2);
  gap: 10px;
  margin-left: -8px;
`;

const TextArea = styled.textarea`
  height: 40px;
  min-height: 40px;
  box-sizing: border-box;
  max-height: 100px;
  flex: 1;
  border: none;
  background-color: transparent;
  font-size: 16px;
  font-family: "Pretendard";
  resize: none;
  overflow-y: auto;

  line-height: 20px;
  padding: 10px 15px;
  margin: 0;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: #999;
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background-color: #373D47;
  cursor: pointer;
`;

const ArrowContainer = styled.div`
  position: absolute;
  bottom: -45px;
  right: -150px;
  margin: 0px 100px 50px 0px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  z-index: 100;
`;

const ArrowButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  background-color: #ffffff;
  color: white;
  border: 1px solid rgba(217, 217, 217, 0.8);
  border-radius: 50%;
  cursor: pointer;
  opacity: ${(props) => (props.disabled ? 0.2 : 1)};
  pointer-events: ${(props) => (props.disabled ? "none" : "auto")};
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;

  &:hover {
    background-color: #f5f5f5;
  }
`;

const TopButtonContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

  const scrollContainerRef = useRef(null);
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

  const currentNodeId = activeNodeIds[activeNodeIds.length - 1] || "root";

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;

    if (scrollHeight <= clientHeight) {
      setScrollPercent(0);
      return;
    }

    const percent = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setScrollPercent(percent);
  };

  const scrollToMessage = (index) => {
    const el = messageRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const calculateTopicMarkers = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const topicNodes = Object.values(nodes).filter(
      (node) => node.parent === "root" && node.id !== "root"
    );

    const totalScrollableHeight = Math.max(1, container.scrollHeight - container.clientHeight);

    const markers = topicNodes
      .map((node) => {
        const dialogNumbers = Object.keys(node.dialog || {}).map(Number);
        if (dialogNumbers.length === 0) return null;

        const firstDialogNumber = Math.min(...dialogNumbers);

        // pair 번호 -> user message index
        const userMessageIndex = (firstDialogNumber - 1) * 2;
        const targetEl = messageRefs.current[userMessageIndex];

        if (!targetEl) return null;

        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const topPx = targetRect.top - containerRect.top + container.scrollTop;

        const topPercent = Math.max(
          0,
          Math.min(100, (topPx / totalScrollableHeight) * 100)
        );

        return {
          nodeId: node.id,
          keyword: node.keyword,
          color: nodeColors[node.id] || "#A5A7AA",
          topPercent,
          messageIndex: userMessageIndex,
        };
      })
      .filter(Boolean);

    setTopicMarkers(markers);
  };

  const handleMarkerClick = (messageIndex) => {
    scrollToMessage(messageIndex);
  };

  useEffect(() => {
    const prevDialogs = prevActiveDialogNumbersRef.current;
    const currDialogs = activeDialogNumbers;

    const prevSorted = [...prevDialogs].sort((a, b) => a - b);
    const currSorted = [...currDialogs].sort((a, b) => a - b);

    const newlyAdded = currSorted.filter((num) => !prevSorted.includes(num));
    const newlyRemoved = prevSorted.filter((num) => !currSorted.includes(num));

    if (newlyAdded.length > 0) {
      const latest = newlyAdded[newlyAdded.length - 1];
      const latestIndex = latest - 1;

      dispatch(setCurrentScrolledDialog(latest));

      setTimeout(() => {
        scrollToMessage(latestIndex);
      }, 0);
    } else if (newlyRemoved.length > 0 && currSorted.length > 0) {
      const closest = currSorted.reduce((prev, curr) => {
        return Math.abs(curr - currentScrolledDialog) < Math.abs(prev - currentScrolledDialog)
          ? curr
          : prev;
      }, currSorted[0]);

      dispatch(setCurrentScrolledDialog(closest));
    }

    prevActiveDialogNumbersRef.current = currDialogs;
  }, [activeDialogNumbers, currentScrolledDialog, dispatch]);

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

        {activeDialogNumbers.length > 0 && (
          <ArrowContainer>
            {(() => {
              const sortedDialogs = [...activeDialogNumbers].sort((a, b) => a - b);
              const currentIndex = sortedDialogs.indexOf(currentScrolledDialog);

              return (
                <>
                  <ArrowButton onClick={() => moveToMessage(-1)} disabled={currentIndex <= 0}>
                    <span
                      className="material-symbols-outlined md-black-font md-30"
                      style={{ userSelect: "none" }}
                    >
                      keyboard_arrow_up
                    </span>
                  </ArrowButton>
                  <ArrowButton
                    onClick={() => moveToMessage(1)}
                    disabled={currentIndex >= sortedDialogs.length - 1}
                  >
                    <span
                      className="material-symbols-outlined md-black-font md-30"
                      style={{ userSelect: "none" }}
                    >
                      keyboard_arrow_down
                    </span>
                  </ArrowButton>
                </>
              );
            })()}
          </ArrowContainer>
        )}

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

        <InputContainer
          $isExpanded={isExpanded}
          style={{ opacity: isLoading ? 0.5 : 1, pointerEvents: isLoading ? "none" : "auto" }}
        >
          <TextArea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="메세지 입력하기"
            disabled={isLoading}
            rows={1}
          />
          <Button onClick={handleSend} disabled={isLoading}>
            <span
              className="material-symbols-outlined md-white md-24"
              style={{ userSelect: "none" }}
            >
              arrow_upward
            </span>
          </Button>
        </InputContainer>
      </ChatContainer>

      <ChatIndex
        scrollPercent={scrollPercent}
        markers={topicMarkers}
        onMarkerClick={handleMarkerClick}
      />
    </LayoutWrapper>
  );
}

export default Chatbot;