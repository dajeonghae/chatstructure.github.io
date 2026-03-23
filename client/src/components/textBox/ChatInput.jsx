import React from "react";
import styled from "styled-components";

const InputContainer = styled.div`
  z-index: 100;
  display: flex;
  width: 95%;
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
  margin-left: -20px;
  margin-bottom: -6px;
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
  background-color: #373d47;
  cursor: pointer;
`;

function ChatInput({
  input,
  isLoading,
  isExpanded,
  textareaRef,
  onChange,
  onKeyDown,
  onSend,
}) {
  return (
    <InputContainer
      $isExpanded={isExpanded}
      style={{
        opacity: isLoading ? 0.5 : 1,
        pointerEvents: isLoading ? "none" : "auto",
      }}
    >
      <TextArea
        ref={textareaRef}
        value={input}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="메세지 입력하기"
        disabled={isLoading}
        rows={1}
      />
      <Button onClick={onSend} disabled={isLoading}>
        <span
          className="material-symbols-outlined md-white md-24"
          style={{ userSelect: "none" }}
        >
          arrow_upward
        </span>
      </Button>
    </InputContainer>
  );
}

export default ChatInput;