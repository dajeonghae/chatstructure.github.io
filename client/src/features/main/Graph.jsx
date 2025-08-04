import React, { useRef, useEffect } from "react";
import styled from "styled-components";
import ReactFlow, { useNodesState, useEdgesState, Background, Controls, BezierEdge } from "reactflow";
import 'reactflow/dist/style.css';
import { useSelector, useDispatch } from "react-redux";
import ContextButton from "../../components/button/ContextButton";
import VisButton from "../../components/button/VisButton";
import CustomEdge from "../../components/graph/CustomEdge";
import CustomTooltipNode from "../../components/tooltip-node/TooltipNode";
import ToggleButton from "../../components/button/ToggleButton";
import { toggleContextMode } from "../../redux/slices/modeSlice";
import { setNodeColors } from "../../redux/slices/nodeSlice";

const edgeTypes = {
  custom: CustomEdge,
  bezier: BezierEdge,
};

const nodeTypes = {
  tooltipNode: CustomTooltipNode,
};

const colorPalette = [
  "#A9DED3", "#FFD93D", "#EC7FA0", "#98E4FF", "#D1A3FF",
  "#6BCB77", "#FF914D", "#93AFEA", "#FFB6C1"
];

// 민트 노랑 초록 하늘 보라
// 빨강 주황 파랑 코랄 

const GraphContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
`;

const ToggleContainer = styled.div`
  position: absolute;
  top: 70px;
  left: 20px;
  z-index: 10;
`;

const VisContainer = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
`;

function getColor(index) {
  return colorPalette[index % colorPalette.length];
}

function Graph() {
  const dispatch = useDispatch();
  const containerRef = useRef(null);
  const activeNodeIds = useSelector((state) => state.node.activeNodeIds);
  const nodesData = useSelector((state) => state.node.nodes) || {};
  const contextMode = useSelector((state) => state.mode.contextMode);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handleToggle = () => {
    dispatch(toggleContextMode());
  };

  useEffect(() => {
    const nodeMap = { ...nodesData };
    const childrenMap = {};
    const positionedMap = {};
    const rootColorMap = {};
    const nodeRootMap = {};
    const updatedNodes = [];
    const updatedEdges = [];

    const spacingX = 340;
    const spacingY = 100;
    let currentY = 10000;
    
    Object.values(nodeMap).forEach((node) => {
      if (node.parent) {
        if (!childrenMap[node.parent]) childrenMap[node.parent] = [];
        childrenMap[node.parent].push(node.id);
      }
    });

    const assignPositions = (nodeId, depth, rootId, inheritedColor) => {
      const node = nodeMap[nodeId];
      const children = childrenMap[nodeId] || [];

      if (!rootColorMap[nodeId]) {
        rootColorMap[nodeId] = inheritedColor;
      }
      nodeRootMap[nodeId] = rootId;

      let subtreeHeight = 0;
      const childPositions = [];

      for (let i = 0; i < children.length; i++) {
        const childId = children[i];
        const childHeight = assignPositions(childId, depth + 1, rootId, inheritedColor);
        subtreeHeight += childHeight;
        childPositions.push({ id: childId, height: childHeight });
      }

      let yPos;
      if (children.length === 0) {
        currentY -= spacingY; // ✅ 아래에서 위로 가도록 감소시킴
        yPos = currentY;
        subtreeHeight = spacingY;
      } else {
        const top = positionedMap[childPositions[0].id].y;
        const bottom = positionedMap[childPositions[childPositions.length - 1].id].y;
        yPos = (top + bottom) / 2;
      }

      
      positionedMap[nodeId] = {
        x: depth * spacingX,
        y: yPos,
      };

      return subtreeHeight;
    };

    const sortedRoots = Object.values(nodeMap)
      .filter((node) => !node.parent)
      .sort((a, b) => a.timestamp - b.timestamp);

    sortedRoots.forEach((root, index) => {
      const color = getColor(index); // ✅ 여기 선언 추가
      rootColorMap[root.id] = color;
      nodeRootMap[root.id] = root.id; // 루트는 자기 자신이 루트임
      assignPositions(root.id, 0, root.id, color); // ✅ rootId 넘김
    });

    sortedRoots.forEach((root) => {
      const children = childrenMap[root.id] || [];
    
      children.forEach((childId, index) => {
        const subTreeColor = getColor(index); // 루트 자식 기준 색상
        const assignSubtreeColor = (nodeId) => {
          rootColorMap[nodeId] = subTreeColor;
          nodeRootMap[nodeId] = childId;
    
          const children = childrenMap[nodeId] || [];
          children.forEach((child) => assignSubtreeColor(child));
        };
    
        assignSubtreeColor(childId); // 자식부터 서브트리 재귀적으로 색상 지정
      });
    });

    Object.keys(positionedMap).forEach((id) => {
      const node = nodeMap[id];
      const isActive = activeNodeIds.includes(id);
      const rootId = nodeRootMap[id];
      const nodeColor = rootColorMap[id] || rootColorMap[node.parent] || "#333";

      updatedNodes.push({
        id,
        type: "tooltipNode",
        data: {
          label: node.keyword,
          color: nodeColor,
          isActive,
        },
        position: positionedMap[id],
        sourcePosition: "right",
        targetPosition: "left",
      });
    });

    Object.values(nodeMap).forEach((node) => {
      if (!node.parent || !nodeMap[node.parent]) return;

      const isActive = activeNodeIds.includes(node.id);
      const parentIsActive = activeNodeIds.includes(node.parent);
      const edgeOpacity = contextMode && !(isActive || parentIsActive) ? 0.2 : 1;
      const rootId = nodeRootMap[node.id];
      const edgeColor = rootColorMap[rootId] || "#333";

      updatedEdges.push({
        id: `${node.parent}-${node.id}`,
        source: node.parent,
        target: node.id,
        label: node.relation || "관련",
        type: "custom",
        animated: false,
        style: {
          strokeWidth: 2,
          stroke: edgeColor,
          opacity: edgeOpacity,
          transition: "opacity 0.2s ease",
        },
        data: {
          sourceId: node.parent,
          targetId: node.id,
          isActive,
          contextMode,
          activeNodeIds,
        },
        labelStyle: {
          fontWeight: 600,
          fontSize: 14,
          opacity: edgeOpacity,
        },
        markerEnd: {
          type: "arrowclosed",
          color: edgeColor,
        },
      });
    });

    setNodes(updatedNodes);
    setEdges(updatedEdges);

    dispatch(setNodeColors(rootColorMap));
  }, [nodesData, activeNodeIds, contextMode]);

  return (
    <GraphContainer ref={containerRef}>
      <ToggleContainer>
        <ToggleButton active={contextMode} onToggle={handleToggle} />
      </ToggleContainer>
      <VisContainer>
        <VisButton />
      </VisContainer>
      <ContextButton />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background variant="dots" gap={20} size={1.5} color="#ddd" />
        <Controls />
      </ReactFlow>
    </GraphContainer>
  );
}

export default Graph;
