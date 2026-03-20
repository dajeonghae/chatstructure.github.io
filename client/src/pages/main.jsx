import React, { useState } from 'react';
import styled from 'styled-components';
import Chatbot from "../features/main/Chatbot.jsx";
import Graph from "../features/main/Graph.jsx";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
  width: 100%;
  overflow: hidden;
`;

const ChatSection = styled.div`
  display: flex;
  flex-direction: column;
  flex: 0 1 auto;
  min-width: 400px;
  height: 100%;
`;

const GraphSection = styled.div`
  display: flex;
  flex: 1 1 0;
  min-width: 300px;
  height: 100%;
  min-height: 0;
`;

const ChatContainer = styled.div`
  display: flex;
  width: 1240px;
  max-width: 100%;
  height: 100%;
  box-sizing: border-box;
`;

const GraphContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
`;

function Main() {
  return (
    <Container>
      <ChatSection>
        <ChatContainer>
          <Chatbot/>
        </ChatContainer>
      </ChatSection>
      <GraphSection>
        <GraphContainer>
          <Graph/>
        </GraphContainer>
      </GraphSection>
    </Container>
  );
}

export default Main;