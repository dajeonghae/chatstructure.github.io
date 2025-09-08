import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { sendMessageToApi } from "../../services/chatbotService.js";
import DialogBox from "../../components/textBox/DialogBox.jsx";
import { setCurrentScrolledDialog, resetState} from "../../redux/slices/nodeSlice.js";
import { parseConversationHistory } from "../../utils/parseConversationHistory.js";
import {
  buildFullSnapshot,
  downloadSnapshotFile,   // ← 추가
  loadSnapshotThunk,      // ← 추가
  saveSnapshotToProject,
  listProjectSnapshots,
  loadSnapshotFromProjectThunk
} from "../../utils/snapshotManager.js";
import { store } from "../../redux/store.js";
import axios from "axios";

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
`;

const MessagesContainer = styled.div`
  flex: 1;
  width: 100%;
  padding: 20px;
  overflow-y: auto;
  scrollbar-width: none;
`;

const InputContainer = styled.div`
  display: flex;
  width: 85%;
  min-height: 40px;
  max-height: 120px;
  align-items: flex-end;         // 버튼과 텍스트에어리어를 아래쪽 정렬
  justify-content: space-between; // center → space-between
  padding: 8px 8px 8px 20px;     // 오른쪽 패딩 줄임 (버튼 공간)
  border-radius: 100px;
  border: 1px solid rgba(240, 240, 240);
  background-color: #ffffff;
  box-shadow: 0px 8px 24px rgba(149, 157, 165, 0.2);
  gap: 10px;                     // 텍스트에어리어와 버튼 사이 간격
`;

const TextArea = styled.textarea`
  min-height: 24px;
  max-height: 96px;              // 컨테이너보다 작게
  flex: 1;
  border: none;
  background-color: transparent;
  font-size: 16px;
  font-family: "Pretendard";
  resize: none;
  overflow-y: auto;
  line-height: 1.2;
  padding: 2px 20px;                // 심플하게
  margin: 0;                     // margin-right 제거
  
  &:focus {
    outline: none;
  }
  
  &::placeholder {
    color: #999;                 // placeholder 색상
  }
`;

const Input = styled.input`
  height: 20px;
  flex: 1;
  border: none;
  background-color: #ffffff;
  margin-right: 10px;
  font-size: 16px;
  font-family: "Pretendard";

  &:focus {
    outline: none;
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
  position: fixed;
  bottom: 100px;
  right: 20px;
  margin: 0px 100px 50px 0px;
  display: flex;
  flex-direction: column;
  gap: 7px;
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

const RestoreButton = styled(SaveButton)`
  background-color: #ed8936;
`;

const ExportButton = styled(SaveButton)`
  background-color: #2d3748;
`;
const ImportButton = styled(SaveButton)`
  background-color: #ffffff;
  color: #2d3748;
  border: 1px solid  #2d3748;
`;


function Chatbot() {
  const [messages, setMessages] = useState([]); // 대화 목록을 배열로 보관
  const [input, setInput] = useState(""); // 입력창 내용을 보관
  const [currentIndex, setCurrentIndex] = useState(0);  // 현재 활성 대화 인덱스
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null); // 맨 아래로 스크롤
  const messageRefs = useRef([]);  // 각 메시지 <div> DOM을 배열로 저장. 특정 메시지로 스크롤할 수 있도록 함
  const fileInputRef = useRef(null)
  const prevActiveDialogNumbersRef = useRef([]);

  const dispatch = useDispatch();

  const dialogNumber = useSelector((state) => state.node.dialogCount);
  const activeDialogNumbers = useSelector((state) => state.node.activeDialogNumbers);  // 활성화된 대화 번호들
  const currentScrolledDialog = useSelector((state) => state.node.currentScrolledDialog);
  const contextMode = useSelector((state) => state.mode.contextMode);

  // 🔥 대화 스크롤 이동 함수
  const scrollToMessage = (index) => {
    if (messageRefs.current[index]) {
      messageRefs.current[index].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // 🔥 대화 추가 시 맨 아래로 스크롤
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };


  useEffect(() => {
    const prevDialogs = prevActiveDialogNumbersRef.current;
    const currDialogs = activeDialogNumbers;

    const prevSorted = [...prevDialogs].sort((a, b) => a - b);
    const currSorted = [...currDialogs].sort((a, b) => a - b);

    const newlyAdded = currSorted.filter(num => !prevSorted.includes(num));
    const newlyRemoved = prevSorted.filter(num => !currSorted.includes(num));

    if (newlyAdded.length > 0) {
      const latest = newlyAdded[newlyAdded.length - 1];
      const latestIndex = latest - 1;

      setCurrentIndex(currSorted.indexOf(latest));
      dispatch(setCurrentScrolledDialog(latest));

      setTimeout(() => {
        scrollToMessage(latestIndex);
      }, 0);
    } else if (newlyRemoved.length > 0 && currSorted.length > 0) {
      // 제거된 번호와 가장 가까운 남은 번호 찾기
      const closest = currSorted.reduce((prev, curr) => {
        return Math.abs(curr - currentScrolledDialog) < Math.abs(prev - currentScrolledDialog)
          ? curr
          : prev;
      }, currSorted[0]);

      dispatch(setCurrentScrolledDialog(closest));
      setCurrentIndex(currSorted.indexOf(closest));

      console.log("🔄 [상태만 갱신] closest:", closest);
    }

    prevActiveDialogNumbersRef.current = currDialogs;
  }, [activeDialogNumbers]);


  // 🔥 새로운 대화가 추가될 때 아래로 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 🔥 화살표 클릭 시 대화 이동
  const moveToMessage = (direction) => {
    const sortedDialogs = [...activeDialogNumbers].sort((a, b) => a - b);
    const currentScrolled = store.getState().node.currentScrolledDialog; // 최신 기준 상태
    const currentDialogIndex = sortedDialogs.indexOf(currentScrolled);
    const nextIndex = currentDialogIndex + direction;

    if (nextIndex >= 0 && nextIndex < sortedDialogs.length) {
      const nextMessageNumber = sortedDialogs[nextIndex];
      dispatch(setCurrentScrolledDialog(nextMessageNumber));
      scrollToMessage(nextMessageNumber - 1);
    }
  };
  
  const activeNodeIds = useSelector((state) => state.node.activeNodeIds);
  const currentNodeId = activeNodeIds[activeNodeIds.length - 1] || "root";

  // const handleSaveState = () => {
  //   const currentState = {
  //     nodes: store.getState().node.nodes,
  //     activeNodeIds: store.getState().node.activeNodeIds,
  //     activeDialogNumbers: store.getState().node.activeDialogNumbers,
  //     dialogCount: store.getState().node.dialogCount,
  //     currentScrolledDialog: store.getState().node.currentScrolledDialog, 
  //     nodeColors: store.getState().node.nodeColors, 
  //     messages,
  //   };
  
  //   localStorage.setItem("testBackup", JSON.stringify(currentState));
  //   alert("✅ 상태 저장 완료!");
  // };
  
  // const handleRestoreState = () => {
  //   const saved = JSON.parse(localStorage.getItem("testBackup"));
  //   if (!saved) return alert("❌ 저장된 상태가 없습니다.");
  
  //   dispatch(resetState(saved));
  //   setMessages(saved.messages);
  //   setCurrentIndex(saved.activeDialogNumbers.length - 1);
  //   dispatch(setCurrentScrolledDialog(saved.activeDialogNumbers[saved.activeDialogNumbers.length - 1]));
  //   alert("♻️ 상태 복원 완료!");
  // };

// [+] 스냅샷 JSON 파일로 내보내기
  const handleExportSnapshot = () => {
    const reduxState = store.getState(); // [+]
    const snapshot = buildFullSnapshot(reduxState, messages);
    downloadSnapshotFile(snapshot);
  };

  // [+] 파일 선택창 오픈
  const handleImportClick = () => {
    fileInputRef.current?.click(); // [+]
  };

  // [+] 스냅샷 JSON 불러오기
  const handleImportSnapshot = async (e) => {
    const file = e.target.files?.[0]; // [+]
    e.target.value = ""; // [+]
    if (!file) return; // [+]
    try {
    const { messages: restored } = await dispatch(loadSnapshotThunk(file));
    setMessages(restored || []);
    // 복원 직후 맨 아래로 스크롤
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 0);
      alert("📦 스냅샷 복원 완료!(JSON)"); // [+]
    } catch (err2) {
      console.error(err2); // [+]
      alert("❌ 스냅샷 불러오기 실패 (콘솔 확인)"); // [+]
    }
  };


  const handleSend = async () => {
    if (input.trim() === "" || isLoading) return; // 로딩 중이면 실행하지 않음

    setIsLoading(true); // 로딩 시작

    const userMessage = {
      role: "user",
      content: input,
      nodeId: currentNodeId,
      number: messages.length + 1,
    };

    let updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");

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
      setIsLoading(false); // 로딩 종료
    }
  };

const handleKeyDown = (e) => {
  if (e.key === "Enter") {
    if (e.shiftKey) {
      // 👉 Shift+Enter: 줄바꿈 허용 (기본 동작 그대로)
      return;
    } else {
      // 👉 그냥 Enter: 전송
      e.preventDefault(); // 줄바꿈 막기
      handleSend();
    }
  }
};

useEffect(() => {
  const onReplay = async (e) => {
    const raw = e?.detail?.text ?? "";
    if (!raw.trim()) return;

    const parsed = parseConversationHistory(raw); // [{role, content}, ...]

    // user/assistant 페어로 묶기
    const pairs = [];
    for (let i = 0; i < parsed.length; i += 2) {
      const user = parsed[i]?.content ?? "";
      const assistant = parsed[i + 1]?.content ?? "";
      if (user) pairs.push({ user, assistant });
    }

    let running = [...messages];

    // 시작 신호(선택: 모달에서도 보냄)
    window.dispatchEvent(new CustomEvent("vis:start"));
    try {
      // 턴 순서대로 실행
      for (const { user, assistant } of pairs) {
        // 1) 사용자 메시지를 먼저 화면에 붙임
        const userMessage = {
          role: "user",
          content: user,
          nodeId: currentNodeId,
          number: running.length + 1,
        };
        running = [...running, userMessage];
        setMessages(running);

        try {
          // 2) 기존 파이프라인 호출(그래프 갱신 포함)
          // assistantOverride로 모델 콜 없이 주어진 assistant 텍스트 사용
          const gptMessageContent = await dispatch(
            sendMessageToApi(user, running, { assistantOverride: assistant }) // [+]
          );

          // 3) 어시스턴트 메시지를 화면에 붙임
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
          // 실패해도 다음 턴 계속 진행(필요시 여기서 중단하도록 변경 가능)
        }
      }
    } finally {
      // 완료 신호(항상 보냄) → 모달이 vis:done을 받으면 닫힘
      window.dispatchEvent(new CustomEvent("vis:done"));
    }
  };

  window.addEventListener("chat:replay", onReplay);
  return () => window.removeEventListener("chat:replay", onReplay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [dispatch, currentNodeId, messages.length]);

const handleLoadFromServer = async () => {
  try {
    const r = await axios.get("http://localhost:8080/api/chatgraph/get");
    const snap = r.data?.snapshot;
    if (!snap) throw new Error("no snapshot returned");

    // snapshotManager.loadSnapshotThunk는 File/객체 모두 지원 → 그대로 사용
    const { messages: restored } = await dispatch(loadSnapshotThunk(snap));
    setMessages(restored || []);

    // 복원 직후 스크롤
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 0);

    alert("♻️ 서버에서 스냅샷 불러오기 완료 (chatgraph.json)");
  } catch (e) {
    console.error(e);
    alert("❌ 서버 불러오기 실패 (콘솔 확인)");
  }
};

const handleInput = (e) => {
  setInput(e.target.value);
  
  // 자동 높이 조절
  e.target.style.height = 'auto';
  e.target.style.height = e.target.scrollHeight + 'px';
};

  return (
    <ChatContainer>
      <MessagesContainer>
        {messages.map((msg, index) => (
          <div
            key={index}
            ref={(el) => (messageRefs.current[index] = el)}  // 🔥 각 메시지에 ref 할당
          >
            <DialogBox
              text={msg.content}
              isUser={msg.role === "user"}
              nodeId={msg.nodeId}
              number={msg.number}
            />
          </div>
        ))}
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
                  <span className="material-symbols-outlined md-black-font md-30" style={{ userSelect: "none" }}>keyboard_arrow_up</span>
                </ArrowButton>
                <ArrowButton onClick={() => moveToMessage(1)} disabled={currentIndex >= sortedDialogs.length - 1}>
                  <span className="material-symbols-outlined md-black-font md-30" style={{ userSelect: "none" }}>keyboard_arrow_down</span>
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
      <InputContainer style={{ opacity: isLoading ? 0.5 : 1, pointerEvents: isLoading ? 'none' : 'auto' }}>
        <TextArea
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="메세지 입력하기"
          disabled={isLoading}
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
  );
}


export default Chatbot;
