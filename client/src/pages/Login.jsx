import React, { useState } from "react";
import styled from "styled-components";

const CREDENTIALS = {
  P1:  "kX9#mQ2$vL",
  P2:  "wR7@nZ4!pJ",
  P3:  "hF3$bT8&cY",
  P4:  "qM6!sW1#dE",
  P5:  "uA5@gK9$xN",
  P6:  "oD2#rV7!mB",
  P7:  "lH8&jP4@zC",
  P8:  "eI1$wQ6#fU",
  P9:  "tS3!nX5&kR",
  P10: "yG7@hM2$bO",
  P11: "cV4#pL8!wA",
  P12: "iN6&dF1@qT",
  P13: "mB9$zK3#rH",
  P14: "xE2!uS7&jG",
  P15: "fP5@cR4$lD",
  P16: "aW8#tI6!nV",
  P17: "jQ1&yB9@mF",
  P18: "vL3$hE5#kX",
  P19: "nC7!oG2&pW",
  P20: "rU4@wN8$zS",
  admin: "contextnaviadmin"
};

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f5f6f8;
`;

const Card = styled.div`
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  width: 340px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Title = styled.div`
  font-size: 22px;
  font-weight: 700;
  color: #373d47;
  text-align: center;
  margin-bottom: 4px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: #575a5e;
  margin-bottom: 6px;
  display: block;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid #e0e3e8;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;

  &:focus {
    border-color: #a0aec0;
  }
`;

const Button = styled.button`
  width: 100%;
  padding: 12px;
  background: #373d47;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #575a5e;
  }
`;

const ErrorMsg = styled.div`
  font-size: 13px;
  color: #e11d48;
  text-align: center;
  min-height: 18px;
`;

export default function Login({ onLogin }) {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimId = id.trim().toUpperCase();
    if (CREDENTIALS[trimId] && CREDENTIALS[trimId] === pw) {
      onLogin(trimId);
    } else {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <Wrapper>
      <Card>
        <Title>로그인</Title>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <Label htmlFor="id">아이디</Label>
            <Input
              id="id"
              type="text"
              placeholder="P1 ~ P20"
              value={id}
              onChange={(e) => { setId(e.target.value); setError(""); }}
              autoComplete="username"
            />
          </div>
          <div>
            <Label htmlFor="pw">비밀번호</Label>
            <Input
              id="pw"
              type="password"
              placeholder="비밀번호 입력"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setError(""); }}
              autoComplete="current-password"
            />
          </div>
          <ErrorMsg>{error}</ErrorMsg>
          <Button type="submit">로그인</Button>
        </form>
      </Card>
    </Wrapper>
  );
}
