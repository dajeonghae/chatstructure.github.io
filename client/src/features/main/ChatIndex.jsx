import React from "react";
import styled from "styled-components";

const IndexWrapper = styled.div`
  width: 60px;
  height: 90%;
  padding: 20px 0;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  margin-left: 10px;
`;

const Track = styled.div`
  position: relative;
  width: 4px;
  height: 100%;
  background-color: #E2E8F0;
  border-radius: 2px;
`;

const TopicMarker = styled.div`
  position: absolute;
  left: -4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${(props) => props.color || "#333"};
  transform: translateY(-50%);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  z-index: 5;

  &:hover::after {
    content: '${(props) => props.keyword}';
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    background: #575A5E;
    color: #fff;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

const ProgressArrow = styled.div`
  position: absolute;
  left: -11px;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 8px solid #c92a2a;
  transition: top 0.1s ease-out;
  z-index: 10;
`;

const ChatIndex = ({ scrollPercent, markers = [], onMarkerClick }) => {
  return (
    <IndexWrapper>
      <Track>
        {markers.map((marker) => (
          <TopicMarker
            key={marker.nodeId}
            style={{ top: `${marker.topPercent}%` }}
            color={marker.color}
            keyword={marker.keyword}
            onClick={() => onMarkerClick?.(marker.messageIndex)}
          />
        ))}

        <ProgressArrow style={{ top: `${scrollPercent}%` }} />
      </Track>
    </IndexWrapper>
  );
};

export default ChatIndex;