import React from "react";
import styled from "styled-components";
import { COLORS } from "../../styles/colors";
import { getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from "reactflow";

const EdgeLabelContainer = styled.div`
  position: absolute;
  background-color: #fcfcfc;
  padding: 2px 8px; /* 공간 확보를 위해 패딩을 살짝 타이트하게 조정 */
  border-radius: 6px;
  font-size: 13px; /* 글자가 겹치지 않게 1px 줄임 */
  font-weight: 500;
  color: #575A5E; /* 폰트 색상을 살짝 부드럽게 조정 */
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
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

  // 기본 path 계산
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  // 🔥 [수정 1] 라벨 X 좌표를 '수평선의 정확한 한가운데'로 배치
  // React Flow의 기본 SmoothStep은 source와 target의 X좌표 중간 지점(1/2)에서 세로로 꺾입니다.
  // 따라서 세로로 꺾인 후 타겟으로 향하는 가로선의 길이는 전체 X 거리의 절반입니다.
  // 이 가로선의 정중앙은 비율상 전체 거리의 3/4 지점이 됩니다.
  const distanceX = targetX - sourceX;
  const customLabelX = targetX - (distanceX / 4); 
  const customLabelY = targetY; // 높이는 타겟 노드와 정확히 맞춤

  // 🔥 [수정 2] label이 문자열 "null"이거나 비어있으면 렌더링하지 않음
  const isValidLabel = label && label !== "null" && label.trim() !== "";

  const edgeStyle = {
    ...style,
    opacity: contextMode ? (isTrulyActive ? 1 : 0.2) : 1,
    transition: "stroke 1.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 1.4s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      {isValidLabel && (
        <EdgeLabelRenderer>
          <EdgeLabelContainer
            style={{
              left: `${customLabelX}px`,
              top: `${customLabelY}px`,
              opacity: edgeStyle.opacity,
              zIndex: 9999,
            }}
          >
            {label}
          </EdgeLabelContainer>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default CustomEdge;