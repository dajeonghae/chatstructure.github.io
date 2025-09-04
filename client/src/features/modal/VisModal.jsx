import React, { useState, useEffect } from "react";
import styled from "styled-components";
import ModalPortal from "../../ModalPortal";
import { useDispatch } from "react-redux";

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: ${({ isOpen }) => (isOpen ? "flex" : "none")};
  align-items: center;
  justify-content: center;
  z-index: 999;
`;

const ModalContent = styled.div`
  background: #fff;
  border-radius: 16px;
  width: 560px;
  max-width: calc(100% - 40px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  position: relative;
`;

const ContentInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 18px;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 12px;
  background: none;
  border: none;
  font-size: 1.6rem;
  cursor: pointer;
`;

const TextArea = styled.textarea`
  width: 100%;
  height: 260px;
  padding: 14px;
  font-size: 1rem;
  font-family: inherit;
  line-height: 1.5;
  border-radius: 10px;
  border: 1px solid #dcdfe3;
  resize: none; /* 크기 조절 불가 */
  box-sizing: border-box;
  outline: none;

  &:focus {
    border-color: #b8bdc4;
    box-shadow: 0 0 0 3px rgba(55, 61, 71, 0.08);
  }
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ReplayButton = styled.button`
  padding: 10px 16px;
  background-color: #373d47;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? "none" : "auto")};
`;

const ClearBtn = styled.button`
  height: 32px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 6px;
  font-size: 13px;
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  pointer-events: ${({ disabled }) => (disabled ? "none" : "auto")};

  &:hover {
    background: #f7f7f8;
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
`;

const Spinner = styled.div`
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #373d47;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const VisModal = ({ isOpen, onClose }) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const handleReplayClick = async () => {
    setLoading(true);
    window.dispatchEvent(new CustomEvent("vis:start"));
    window.dispatchEvent(new CustomEvent("chat:replay", { detail: { text } }));
  };

  useEffect(() => {
    const onDone = () => {
      setLoading(false);
      onClose();
    };
    window.addEventListener("vis:done", onDone);
    return () => window.removeEventListener("vis:done", onDone);
  }, [onClose]);

  return (
    <ModalPortal>
      <ModalOverlay
        isOpen={isOpen}
        onClick={() => {
          if (!loading) onClose();
        }}
      >
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <CloseButton onClick={onClose} aria-label="Close">
            ×
          </CloseButton>

          <ContentInner>
            <HeaderRow>
              <Title>Paste your conversation history below:</Title>
            </HeaderRow>

            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`User: ...\nAssistant: ...`}
            />

            {/* Replay 버튼 왼쪽 / Clear 버튼 오른쪽 */}
            <FooterRow>
              <ReplayButton onClick={handleReplayClick} disabled={loading}>
                {loading ? "로딩..." : "▶ History Visualization 시작"}
              </ReplayButton>
              <ClearBtn
                onClick={() => setText("")}
                disabled={!text}
                aria-label="Clear textarea"
              >
                지우기
              </ClearBtn>
            </FooterRow>
          </ContentInner>

          {loading && (
            <LoadingOverlay>
              <Spinner />
            </LoadingOverlay>
          )}
        </ModalContent>
      </ModalOverlay>
    </ModalPortal>
  );
};

export default VisModal;
