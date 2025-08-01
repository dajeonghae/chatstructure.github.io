import React from "react";
import styled from "styled-components";
import { COLORS } from "../../styles/colors";
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "reactflow";

// 🔥 스타일 컴포넌트
const EdgeLabelContainer = styled.div`
  position: absolute;
  background-color: #fcfcfc;
  padding: 2px;
  padding-bottom: 10px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 500;
  color: ${COLORS.black_font};
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  transform: translate(-50%, -50%);
`;

const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  label,
  markerEnd,
  data,
}) => {

  const contextMode = data?.contextMode || false;
  const sourceId = data?.sourceId;
  const targetId = data?.targetId;
  const activeNodeIds = data?.activeNodeIds || [];

  const isTrulyActive = activeNodeIds.includes(sourceId) && activeNodeIds.includes(targetId);

  const yOffset = 4; 

  // 베지어 경로와 중앙점 계산
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY: sourceY + yOffset,
    targetX,
    targetY: targetY + yOffset,
    sourcePosition,
    targetPosition,
  });

const edgeStyle = {
  ...style,
  opacity: contextMode ? (isTrulyActive ? 1 : 0.2) : 1,
  transition: "opacity 0.2s ease",
};

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      <EdgeLabelRenderer>
        <EdgeLabelContainer
          style={{
            left: `${labelX}px`,
            top: `${labelY}px`,
            opacity: edgeStyle.opacity,  // ✅ Graph에서 설정한 투명도 사용
          }}
        >
          {label}
        </EdgeLabelContainer>
      </EdgeLabelRenderer>
    </>
  );
};

export default CustomEdge;
