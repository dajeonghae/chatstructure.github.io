import React, { useState } from "react";
import styled from "styled-components";
import ModalPortal from "../../ModalPortal";
import { replayConversation } from "../../services/replayService";
import { useDispatch } from "react-redux";

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: ${({ isOpen }) => (isOpen ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  z-index: 999;
`;

const ModalContent = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  width: 500px;
  max-width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
`;

const CloseButton = styled.button`
  float: right;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
`;

const ReplayButton = styled.button`
  margin-top: 12px;
  padding: 10px 16px;
  background-color: #373d47;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
`;

const VisModal = ({ isOpen, onClose }) => {
  const [text, setText] = useState("");
  const dispatch = useDispatch();

  const currentNodeId = "root"; // 테스트용 기본 ID

const handleReplayClick = async () => {
  await replayConversation(text, currentNodeId);
  onClose();
};


  return (
    <ModalPortal>
      <ModalOverlay isOpen={isOpen} onClick={onClose}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <CloseButton onClick={onClose}>×</CloseButton>
          <h3>Paste your conversation history below:</h3>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{
              width: "100%",
              height: "200px",
              marginTop: "12px",
              padding: "10px",
              fontSize: "1rem",
              fontFamily: "inherit",
              borderRadius: "8px",
              border: "1px solid #ccc",
              resize: "vertical",
            }}
            placeholder={`User: ...\nAssistant: ...`}
          />
          <ReplayButton onClick={handleReplayClick}>▶ 대화 재생</ReplayButton>
        </ModalContent>
      </ModalOverlay>
    </ModalPortal>
  );
};

export default VisModal;
