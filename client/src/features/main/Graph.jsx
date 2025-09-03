import React, { useRef, useEffect, useState } from "react";
import styled from "styled-components";
import ReactFlow, { useNodesState, useEdgesState, Background, Controls, BezierEdge } from "reactflow";
import "reactflow/dist/style.css";
import { useSelector, useDispatch } from "react-redux";
import ContextButton from "../../components/button/ContextButton";
import VisButton from "../../components/button/VisButton";
import CustomEdge from "../../components/graph/CustomEdge";
import CustomTooltipNode from "../../components/tooltip-node/TooltipNode";
import ToggleButton from "../../components/button/ToggleButton";
import { toggleContextMode } from "../../redux/slices/modeSlice";
import { setNodeColors } from "../../redux/slices/nodeSlice";

const edgeTypes = { custom: CustomEdge, bezier: BezierEdge };
const nodeTypes = { tooltipNode: CustomTooltipNode };

const colorPalette = [
  "#A9DED3", "#FFD93D", "#EC7FA0", "#98E4FF", "#D1A3FF",
  "#6BCB77", "#FF914D", "#93AFEA", "#FFB6C1"
];

const Page = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  gap: 12px;
`;

const GraphPanel = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
`;

const HelperContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 20px;
  align-items: stretch;
  width: 100%;
`;

const HelperPanel = styled.div`
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 28px 26px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
`;

const TokenPanel = styled(HelperPanel)`
  flex: 0 0 260px;
`;

const KeywordPanel = styled(HelperPanel)`
  flex: 1 1 auto;
`;

const PanelTitle = styled.div`
  font-weight: 700;
  margin-bottom: 12px;
  color: #575A5E;
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

/* transient prop 사용: $percent */
const ProgressBar = styled.div`
  width: 100%;
  height: 12px;
  background: #eee;
  border-radius: 25px;
  overflow: hidden;
  margin: 8px 0px 6px 0px;

  & > div {
    height: 100%;
    border-radius: 25px;
    background: #575A5E;
    width: ${(p) => p.$percent}%;
    transition: width 0.3s ease;
  }
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const Chip = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: ${(p) => (p.alt ? "#FDE2E4" : "#E2F0CB")};
  color: #333;
  font-size: 13px;
`;

const SlideSection = styled.div`
  height: ${(p) => p.$h}px;
  padding: ${(p) => (p.$open ? "8px 0" : "0")};
  box-sizing: content-box; /* height에 padding 미포함 (중요) */
  transition:
    height 280ms ease,
    padding 280ms ease,
    opacity 220ms ease,
    transform 280ms ease;
  opacity: ${(p) => (p.$open ? 1 : 0)};
  transform: translateY(${(p) => (p.$open ? "0px" : "8px")});
`;

/* ── 유틸 ───────────────────────────────────────────────────────────── */
function getColor(index) {
  return colorPalette[index % colorPalette.length];
}

function Graph() {
  const dispatch = useDispatch();
  const containerRef = useRef(null);

  const activeNodeIds = useSelector((state) => state.node.activeNodeIds);
  const nodesData = useSelector((state) => state.node.nodes) || {};
  const contextMode = useSelector((state) => state.mode.contextMode);

  const [helpersHeight, setHelpersHeight] = useState(0);
  const helpersInnerRef = useRef(null);

  // 데모 데이터(원하면 Redux 값으로 교체)
  const tokenUsed = 9600;
  const tokenLimit = 15900;
  const percent = Math.round((tokenUsed / tokenLimit) * 100);
  const keywords = ["campus", "engineering", "food", "pohang"];

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const handleToggle = () => dispatch(toggleContextMode());

  /* ── 그래프 배치 useEffect (기존 로직 그대로) ─────────────────────── */
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
      if (!node?.id) return;
      if (node.parent) {
        if (!childrenMap[node.parent]) childrenMap[node.parent] = [];
        childrenMap[node.parent].push(node.id);
      }
    });

    const assignPositions = (nodeId, depth, rootId, inheritedColor) => {
      const children = childrenMap[nodeId] || [];

      if (!rootColorMap[nodeId]) rootColorMap[nodeId] = inheritedColor;
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
        currentY -= spacingY;
        yPos = currentY;
        subtreeHeight = spacingY;
      } else {
        const top = positionedMap[childPositions[0].id].y;
        const bottom = positionedMap[childPositions[childPositions.length - 1].id].y;
        yPos = (top + bottom) / 2;
      }

      positionedMap[nodeId] = { x: depth * spacingX, y: yPos };
      return subtreeHeight;
    };

    const sortedRoots = Object.values(nodeMap)
      .filter((n) => n && !n.parent)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    sortedRoots.forEach((root, idx) => {
      const color = getColor(idx);
      rootColorMap[root.id] = color;
      nodeRootMap[root.id] = root.id;
      assignPositions(root.id, 0, root.id, color);
    });

    sortedRoots.forEach((root) => {
      const children = childrenMap[root.id] || [];
      children.forEach((childId, idx) => {
        const subTreeColor = getColor(idx);
        const paint = (nid) => {
          rootColorMap[nid] = subTreeColor;
          nodeRootMap[nid] = childId;
          (childrenMap[nid] || []).forEach(paint);
        };
        paint(childId);
      });
    });

    Object.keys(positionedMap).forEach((id) => {
      const node = nodeMap[id];
      const isActive = activeNodeIds.includes(id);
      const nodeColor = rootColorMap[id] || rootColorMap[node.parent] || "#333";

      updatedNodes.push({
        id,
        type: "tooltipNode",
        data: { label: node.keyword, color: nodeColor, isActive },
        position: positionedMap[id],
        sourcePosition: "right",
        targetPosition: "left",
      });
    });

    Object.values(nodeMap).forEach((node) => {
      if (!node?.parent || !nodeMap[node.parent]) return;

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
        data: { sourceId: node.parent, targetId: node.id, isActive, contextMode, activeNodeIds },
        labelStyle: { fontWeight: 600, fontSize: 14, opacity: edgeOpacity },
        markerEnd: { type: "arrowclosed", color: edgeColor },
      });
    });

    setNodes(updatedNodes);
    setEdges(updatedEdges);
    dispatch(setNodeColors(rootColorMap));
  }, [nodesData, activeNodeIds, contextMode, dispatch]);

  /* ── 슬라이드 높이 측정 useEffect (⭐ 바깥에 분리) ─────────────────── */
  useEffect(() => {
    const measure = () => {
      const el = helpersInnerRef.current;
      setHelpersHeight(contextMode && el ? el.getBoundingClientRect().height : 0);
    };
    // 다음 페인트 이후에 측정 (더 부드럽게)
    requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [contextMode, keywords.length, tokenUsed, tokenLimit]);

  return (
    <Page>
      {/* 1) 그래프 패널 */}
      <GraphPanel ref={containerRef}>
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
      </GraphPanel>

      {/* 2) 아래 패널: 밀어내며 슬라이드 */}
      <SlideSection $h={helpersHeight} $open={contextMode}>
        <div ref={helpersInnerRef}>
          <HelperContainer>
            <TokenPanel>
              <PanelTitle>Token Info</PanelTitle>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#373D47' }}>{percent}%</span>
                <span style={{ color: "#A5A7AA" }}>occupied</span>
              </div>
              <ProgressBar $percent={percent}><div /></ProgressBar>
              <small>
                <strong style={{ fontWeight: 800, color: '#373D47' }}>
                  {tokenUsed.toLocaleString()}
                </strong>
                {" / "}
                {tokenLimit.toLocaleString()}
              </small>
            </TokenPanel>

            <KeywordPanel>
              <PanelTitle>Selected Keyword</PanelTitle>
              <Chips>
                {keywords.map((kw, i) => (
                  <Chip key={kw} alt={i % 2 === 1}>{kw}</Chip>
                ))}
              </Chips>
            </KeywordPanel>
          </HelperContainer>
        </div>
      </SlideSection>
    </Page>
  );
}

export default Graph;
