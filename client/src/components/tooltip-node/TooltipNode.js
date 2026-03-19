import React, { memo } from "react";
import { Handle, Position } from "reactflow";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { setHoveredNodes, clearHoveredNodes } from "../../redux/slices/modeSlice";
import { toggleActiveNode } from "../../redux/slices/nodeSlice"; // ✅ 노드 토글 액션 가져오기
import { COLORS } from "../../styles/colors";

const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
`;

// 676B71

const NodeContent = styled.div`
  padding: 10px 20px;
  border-radius: 20px;
  background: ${(props) =>
    props.isActive
      ? "#606368"
      : props.isHovered
      ? "#A0AEC0"
      : props.isContextMode
      ? "rgba(217, 217, 217, 0.4)" // Context 모드에서 비활성 노드의 색상
      : "#fff"};
  color: ${(props) => (props.isActive ? "white" : COLORS.dark_grey_font)};
  text-align: center;
  border: 1px solid
    ${(props) =>
      props.isActive
        ? props.borderColor || "#48BB78" // ✅ 활성화 시엔 color 사용
        : "#d9d9d9"};
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.3s;
  opacity: ${(props) => (props.isContextMode && !props.isActive ? 0.3 : 1)};
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-weight: 600;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }
`;

// 부모 노드를 모두 가져오는 함수
const getAllParentNodes = (nodeId, nodesData) => {
  let currentNode = nodesData[nodeId];
  const parentNodes = [];

  console.log("🔍 부모 노드 추적 시작 - 현재 노드 ID:", nodeId);

  while (currentNode && currentNode.parent) {
    console.log("🔗 현재 노드:", currentNode.id, "| 부모 노드:", currentNode.parent);

    if (!nodesData[currentNode.parent]) {
      console.error("❗ 부모 노드를 찾을 수 없음:", currentNode.parent);
      break;
    }

    parentNodes.push(currentNode.parent);
    currentNode = nodesData[currentNode.parent];
  }

  console.log("✅ 부모 노드 추적 완료 - 부모 노드 목록:", parentNodes);
  return parentNodes.reverse(); // 부모에서 자식 순서로 정렬
};

// 자식 노드를 모두 가져오는 함수
const getAllChildNodes = (nodeId, nodesData) => {
  const childNodes = [];
  const queue = [nodeId];

  while (queue.length) {
    const currentId = queue.shift();
    const currentNode = nodesData[currentId];

    if (!currentNode) continue;

    childNodes.push(currentId);

    // 현재 노드의 자식들을 큐에 추가
    currentNode.children.forEach((childId) => {
      queue.push(childId);
    });
  }

  return childNodes;
};


const TooltipNode = ({ data, id }) => {
  const dispatch = useDispatch();
  const linearMode = useSelector((state) => state.mode.linearMode);
  const treeMode = useSelector((state) => state.mode.treeMode);
  const contextMode = useSelector((state) => state.mode.contextMode);
  const hoveredNodeIds = useSelector((state) => state.mode.hoveredNodeIds);
  const activeNodeIds = useSelector((state) => state.node.activeNodeIds);
  const nodesData = useSelector((state) => state.node.nodes);

  const isHovered = hoveredNodeIds.includes(id);
  const isActive = activeNodeIds.includes(id);

  const handleMouseEnter = () => {
    if (linearMode) {
      const parentNodes = getAllParentNodes(id, nodesData);
      const hoverPath = [...parentNodes, id];
      dispatch(setHoveredNodes(hoverPath));
    } else if (treeMode) {
      const childNodes = getAllChildNodes(id, nodesData);
      dispatch(setHoveredNodes(childNodes));
    }
  };

  const handleMouseLeave = () => {
    if (linearMode || treeMode) {
      dispatch(clearHoveredNodes());
    }
  };

  const handleClick = (event) => {
    event.stopPropagation();
    if (linearMode && hoveredNodeIds.length > 0) {
      hoveredNodeIds.forEach((hoveredId) => {
        dispatch(toggleActiveNode(hoveredId));
      });
    } else if (treeMode && hoveredNodeIds.length > 0) {
      hoveredNodeIds.forEach((hoveredId) => {
        dispatch(toggleActiveNode(hoveredId));
      });
    } else {
      dispatch(toggleActiveNode(id));
    }
  };

  return (
    <TooltipContainer onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={handleClick}>
      <NodeContent isHovered={isHovered} isActive={isActive} isContextMode={contextMode} borderColor={data.color}>
        {data.label}
      </NodeContent>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: data.isIndexHighlighted !== false ? data.color : "#BEBEBE", transition: "background 0.2s ease" }}
      />
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: data.isIndexHighlighted !== false ? data.color : "#BEBEBE", transition: "background 0.2s ease" }}
      />
    </TooltipContainer>
  );
};

export default memo(TooltipNode);
