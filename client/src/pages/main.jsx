import React, { useState } from 'react';
import styled from 'styled-components';
import Chatbot from "../features/main/Chatbot.jsx";
import Graph from "../features/main/Graph.jsx";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
  width: 100%;
`;

const ChatSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center; 
  flex: 1;
`;

const GraphSection = styled.div`
  display: flex;
  align-items: center; 
  justify-content: center;
  flex: 1;
`;

const ChatContainer = styled.div`
  display: flex;
  width: 900px;
  height: 92%;
  margin-top: 20px;
`;

const GraphContainer = styled.div`
  display: flex;
  width: 90%;
  height: 90%;
  border-radius: 20px;
  border: 1px solid rgba(217, 217, 217, 0.5);
  background-color: rgba(226, 226, 226, 0.1);
`;

function Main() {
  return (
    <Container>
      <GraphSection>
        <GraphContainer>
          <Graph/>
        </GraphContainer>
      </GraphSection>
      <ChatSection>
        <ChatContainer>
          <Chatbot/>
        </ChatContainer>
      </ChatSection>
    </Container>
  );
}

export default Main;