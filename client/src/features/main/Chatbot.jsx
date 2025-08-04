import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { sendMessageToApi } from "../../services/chatbotService.js";
import DialogBox from "../../components/textBox/DialogBox.jsx";
import { setCurrentScrolledDialog, resetState} from "../../redux/slices/nodeSlice.js";
import { store } from "../../redux/store.js"; 

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
  width: 80%;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 7px 13px 7px 20px;
  border-radius: 100px;
  border: 1px solid rgba(240, 240, 240);
  background-color: #ffffff;
  box-shadow: 0px 8px 24px rgba(149, 157, 165, 0.2);
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

const SaveButton = styled.button`
  position: fixed;
  bottom: 160px;
  right: 20px;
  padding: 8px 12px;
  background-color: #4299e1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
`;

const RestoreButton = styled(SaveButton)`
  bottom: 210px;
  background-color: #ed8936;
`;

function Chatbot() {
  const [messages, setMessages] = useState([]); // 대화 목록을 배열로 보관
  const [input, setInput] = useState(""); // 입력창 내용을 보관
  const [currentIndex, setCurrentIndex] = useState(0);  // 현재 활성 대화 인덱스

  const messagesEndRef = useRef(null); // 맨 아래로 스크롤
  const messageRefs = useRef([]);  // 각 메시지 <div> DOM을 배열로 저장. 특정 메시지로 스크롤할 수 있도록 함
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

  const handleSaveState = () => {
    const currentState = {
      nodes: store.getState().node.nodes,
      activeNodeIds: store.getState().node.activeNodeIds,
      activeDialogNumbers: store.getState().node.activeDialogNumbers,
      dialogCount: store.getState().node.dialogCount,
      messages,
    };
  
    localStorage.setItem("testBackup", JSON.stringify(currentState));
    alert("✅ 상태 저장 완료!");
  };
  
  const handleRestoreState = () => {
    const saved = JSON.parse(localStorage.getItem("testBackup"));
    if (!saved) return alert("❌ 저장된 상태가 없습니다.");
  
    dispatch(resetState(saved));
    setMessages(saved.messages);
    setCurrentIndex(saved.activeDialogNumbers.length - 1);
    dispatch(setCurrentScrolledDialog(saved.activeDialogNumbers[saved.activeDialogNumbers.length - 1]));
    alert("♻️ 상태 복원 완료!");
  };

  const handleSend = async () => {
    if (input.trim() === "") return;

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
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
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
          <SaveButton onClick={handleSaveState}>💾 저장</SaveButton>
    <RestoreButton onClick={handleRestoreState}>♻️ 복원</RestoreButton>
      <InputContainer>
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메세지 입력하기"
        />
        <Button onClick={handleSend}>
          <span className="material-symbols-outlined md-white md-24" style={{ userSelect: "none" }}>arrow_upward</span>
        </Button>
      </InputContainer>
    </ChatContainer>
  );
}


export default Chatbot;
