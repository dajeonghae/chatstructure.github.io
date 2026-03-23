import React, { useRef, useEffect, useState, useMemo } from "react";
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

const TopicBgNode = ({ data }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      borderRadius: "20px",
      backgroundColor: data.color,
      opacity: 0.12,
      transition: "opacity 0.5s ease, background-color 0.5s ease",
      pointerEvents: "none",
    }}
  />
);

const nodeTypes = { tooltipNode: CustomTooltipNode, topicBg: TopicBgNode };

const TOKEN_LIMIT = 15900;

const colorPalette = [
  "#A9DED3", "#FFD93D", "#EC7FA0", "#98E4FF", "#D1A3FF",
  "#6BCB77", "#FF914D", "#93AFEA", "#FFB6C1"
];

function getColor(index) {
  return colorPalette[index % colorPalette.length];
}

const Page = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
`;

const GraphPanel = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  background: #FCFCFC;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
`;

const HelperContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  align-items: stretch;
  width: 100%;
`;

const HelperPanel = styled.div`
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 28px 26px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
`;

const TokenPanel = styled(HelperPanel)`
  flex: 0 0 260px;
`;

const KeywordPanel = styled(HelperPanel)`
  flex: 1 1 auto;
`;

const FixedKeywordsBox = styled.div`
  height: 92px;          
  overflow: auto;        
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

const ProgressBar = styled.div`
  position: relative;
  width: 100%;
  height: 12px;
  background: #eee;
  border-radius: 25px;
  overflow: hidden;
  margin: 8px 0 6px 0;

  .fill {
    height: 100%;
    border-radius: 25px;
    transition: width 0.3s ease, background 0.25s ease;
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
  background: ${(p) => p.$bg || "#E2F0CB"};
  color: ${(p) => p.$fg || "#333"};
  font-size: 13px;
  font-weight: 500;
`;

const SlideSection = styled.div`
  height: ${(p) => p.$h}px;
  padding: ${(p) => (p.$open ? "8px 10px" : "0")};
  box-sizing: content-box;
  transition:
    height 280ms ease,
    padding 280ms ease,
    opacity 220ms ease,
    transform 280ms ease;
  opacity: ${(p) => (p.$open ? 1 : 0)};
  transform: translateY(${(p) => (p.$open ? "0px" : "8px")});
`;

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ra = (pa >> 16) & 0xff, ga = (pa >> 8) & 0xff, ba = pa & 0xff;
  const rb = (pb >> 16) & 0xff, gb = (pb >> 8) & 0xff, bb = pb & 0xff;
  const r = Math.round(ra + (rb - ra) * t);
  const g = Math.round(ga + (gb - ga) * t);
  const b2 = Math.round(ba + (bb - ba) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b2).toString(16).slice(1).toUpperCase()}`;
}

function getFillColor(percent) {
  const base = "#575A5E";
  const dark = "#7F1D1D";
  const danger = "#E11D48";

  if (percent < 85) return base;
  if (percent >= 95) return danger;

  const t = (percent - 85) / (95 - 85);
  return mixHex(dark, danger, t);
}

function hexToRgb(hex = "#000000") {
  const x = hex.replace("#", "");
  const r = parseInt(x.substring(0, 2), 16) || 0;
  const g = parseInt(x.substring(2, 4), 16) || 0;
  const b = parseInt(x.substring(4, 6), 16) || 0;
  return { r, g, b };
}

function hexWithAlpha(hex, alpha = 0.4) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function dullify(hex, amount = 0.5) {
  return mixHex(hex, "#111111", amount);
}

function estimateTokensForText(s = "") {
  if (!s) return 0;
  const cjkRegex = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u3040-\u30FF\u31F0-\u31FF\u3400-\u9FFF]/g;
  const cjkMatches = s.match(cjkRegex) || [];
  const cjkCount = cjkMatches.length;
  const nonCjkCount = s.length - cjkCount;
  const nonCjkTokens = Math.ceil(nonCjkCount / 4);
  const overhead = 2;
  return cjkCount + nonCjkTokens + overhead;
}

function estimateTurnTokens(userMessage = "", gptMessage = "") {
  const u = `[User] ${userMessage}`;
  const a = `[Assistant] ${gptMessage}`;
  const sep = 2;
  return estimateTokensForText(u) + estimateTokensForText(a) + sep;
}

function normalizeKeyword(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function Graph() {
  const dispatch = useDispatch();
  const containerRef = useRef(null);

  const activeNodeIds = useSelector((state) => state.node.activeNodeIds);
  const nodesData = useSelector((state) => state.node.nodes) || {};
  const contextMode = useSelector((state) => state.mode.contextMode);
  const nodeColors = useSelector((state) => state.node.nodeColors) || {};
  const selectedIndexNodeId = useSelector((state) => state.node.selectedIndexNodeId);

  const [helpersHeight, setHelpersHeight] = useState(0);
  const helpersInnerRef = useRef(null);

  const [tokenUsed, setTokenUsed] = useState(0);
  const tokenLimit = TOKEN_LIMIT;
  const percent = Math.min(100, Math.round((tokenUsed / tokenLimit) * 100));

  let status = { text: "occupied", color: "#A5A7AA" };
  if (percent >= 100) {
    status = {
      text: "⚠︎ 100% 초과: history가 요약되어 맥락 손실이 발생할 수 있어요",
      color: "#B91C1C",
    };
  } else if (percent >= 95) {
    status = { text: "⚠︎ 매우 혼잡 (요약 임박)", color: "#DC2626" };
  } else if (percent >= 85) {
    status = { text: "주의: 여유 거의 없음", color: "#F97316" };
  }

  const fillColor = getFillColor(percent);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isDraggable, setIsDraggable] = useState(false);

  const handleToggle = () => dispatch(toggleContextMode());

  const keywordChips = useMemo(() => {
    const seen = new Map();
    activeNodeIds.forEach((nid) => {
      const node = nodesData[nid];
      if (!node) return;

      const base = (nodeColors && nodeColors[nid]) || "#E2F0CB";
      const chipBg = hexWithAlpha(base, 0.25);
      const chipFg = dullify(base, 0.6);

      const kws = Array.isArray(node.keywords) ? node.keywords : [];
      kws.forEach((kw) => {
        const norm = normalizeKeyword(kw);
        if (!norm) return;
        if (!seen.has(norm)) {
          seen.set(norm, { kw, nid, bg: chipBg, fg: chipFg });
        }
      });
    });
    return Array.from(seen.values());
  }, [activeNodeIds, nodesData, nodeColors]);

  useEffect(() => {
    const nodeMap = { ...nodesData };
    const childrenMap = {};
    const positionedMap = {};
    const rootColorMap = {};
    const nodeRootMap = {};
    const updatedNodes = [];
    const updatedEdges = [];

    // 부모-자식 관계 설정
    Object.values(nodeMap).forEach((node) => {
      if (!node?.id) return;
      if (node.parent) {
        if (!childrenMap[node.parent]) childrenMap[node.parent] = [];
        childrenMap[node.parent].push(node.id);
      }
    });

    // 🔥 자식 노드를 '생성 시간' 순으로 정렬 (과거 -> 미래)
    Object.keys(childrenMap).forEach((parentId) => {
      childrenMap[parentId].sort((aId, bId) => {
        const nodeA = nodeMap[aId];
        const nodeB = nodeMap[bId];
        // createdAt이 없으면 0으로 취급하여 안전하게 정렬
        return (nodeA.createdAt || 0) - (nodeB.createdAt || 0);
      });
    });

    const nodeDepths = {};
    const getDepth = (id) => {
      if (nodeDepths[id] !== undefined) return nodeDepths[id];
      const node = nodeMap[id];
      if (!node || !node.parent || !nodeMap[node.parent]) {
        nodeDepths[id] = 0;
        return 0;
      }
      const d = getDepth(node.parent) + 1;
      nodeDepths[id] = d;
      return d;
    };

    Object.keys(nodeMap).forEach(getDepth);

    const estimateNodeWidth = (text) => {
      const str = String(text || "");
      let w = 0;
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        if (charCode === 32) w += 14 * 0.3; 
        else if (charCode >= 0xac00 && charCode <= 0xd7a3) w += 14 * 0.95;
        else w += 14 * 0.6; 
      }
      return w + 44; 
    };

    const estimateRelWidth = (text) => {
      const str = String(text || "");
      if (str === "null" || str === "") return 0;
      let w = 0;
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        if (charCode === 32) w += 13 * 0.3;
        else if (charCode >= 0xac00 && charCode <= 0xd7a3) w += 13 * 0.95;
        else w += 13 * 0.6;
      }
      return w + 16; 
    };

    const gapAtDepth = {};

    Object.values(nodeMap).forEach((node) => {
      if (!node.parent || !nodeMap[node.parent]) return;
      
      const pDepth = nodeDepths[node.parent];
      const pNode = nodeMap[node.parent];
      
      const pNodeWidth = estimateNodeWidth(pNode.keyword); 
      const relWidth = estimateRelWidth(node.relation); 
      
      const buffer = relWidth > 0 ? 15 : 0;
      const requiredDistanceX = (relWidth + buffer) * 2;
      const requiredGap = pNodeWidth + requiredDistanceX;
      
      if (!gapAtDepth[pDepth] || requiredGap > gapAtDepth[pDepth]) {
        gapAtDepth[pDepth] = requiredGap;
      }
    });

    const depthX = { 0: 0 };
    const maxD = Math.max(...Object.values(nodeDepths), 0);
    
    for (let d = 0; d <= maxD; d++) {
       const gap = Math.max(gapAtDepth[d] || 240, 240);
       depthX[d+1] = depthX[d] + gap;
    }

    const spacingY = 100;
    // Y좌표는 0부터 시작해서 아래로 증가 (Top-Down)
    let currentY = 0; 

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
        // 리프 노드: 현재 커서 위치에 배치하고, 커서를 아래로 이동
        yPos = currentY;
        currentY += spacingY; 
        subtreeHeight = spacingY;
      } else {
        // 🔥 [핵심 수정] 부모 노드 위치 계산 로직 변경
        // 기존: (top + bottom) / 2  -> 중앙 정렬 (위아래 대칭 발생)
        // 변경: childPositions[0].y -> 첫 번째 자식(가장 오래된 자식)과 높이를 맞춤
        
        // 이렇게 하면 부모가 항상 그룹의 '상단'에 위치하게 되어, 
        // 새로운 자식들은 부모보다 '아래쪽'으로만 쌓이게 됩니다.
        yPos = positionedMap[childPositions[0].id].y;
      }

      positionedMap[nodeId] = { x: depthX[depth], y: yPos };
      return subtreeHeight;
    };

    const sortedRoots = Object.values(nodeMap)
      .filter((n) => n && !n.parent)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

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

    // root 노드는 항상 중립 색상
    rootColorMap["root"] = "#606368";

    // 배경 rect: 활성 노드를 column(같은 x)별로 묶고, 사이에 비활성 노드 없는 것만 합침
    const highlightSet = new Set();
    if (!contextMode) {
      activeNodeIds.forEach((id) => { if (positionedMap[id]) highlightSet.add(id); });
      if (selectedIndexNodeId) {
        Object.keys(nodeRootMap).forEach((id) => {
          if (nodeRootMap[id] === selectedIndexNodeId && positionedMap[id]) highlightSet.add(id);
        });
      }
    }
    const highlightedRootIds = new Set([...highlightSet].map((id) => nodeRootMap[id]).filter(Boolean));

    const calcNodeW = (id) => {
      const str = String(nodeMap[id]?.keyword || "");
      let w = 0;
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c === 32) w += 14 * 0.3;
        else if (c >= 0xac00 && c <= 0xd7a3) w += 14 * 0.95;
        else w += 14 * 0.6;
      }
      return w + 44;
    };

    const pad = 24;
    const nodeH = 44;

    // 비활성 노드 center point (같은 rootId 내 충돌 검사용)
    const nonActiveCenters = Object.keys(positionedMap)
      .filter((id) => !highlightSet.has(id))
      .map((id) => ({
        rootId: nodeRootMap[id],
        cx: positionedMap[id].x + calcNodeW(id) / 2,
        cy: positionedMap[id].y + nodeH / 2,
      }));

    // 활성 노드 개별 rect
    let bgRects = [];
    highlightSet.forEach((id) => {
      bgRects.push({
        rootId: nodeRootMap[id],
        x1: positionedMap[id].x - pad,
        y1: positionedMap[id].y - pad,
        x2: positionedMap[id].x + calcNodeW(id) + pad,
        y2: positionedMap[id].y + nodeH + pad,
      });
    });

    // 합쳤을 때 같은 rootId 비활성 노드 center가 들어오지 않으면 merge
    const canMerge = (a, b) => {
      if (a.rootId !== b.rootId) return false;
      const mx1 = Math.min(a.x1, b.x1), my1 = Math.min(a.y1, b.y1);
      const mx2 = Math.max(a.x2, b.x2), my2 = Math.max(a.y2, b.y2);
      return !nonActiveCenters.some(
        (n) => n.rootId === a.rootId && n.cx > mx1 && n.cx < mx2 && n.cy > my1 && n.cy < my2
      );
    };

    let didMerge = true;
    while (didMerge) {
      didMerge = false;
      for (let i = 0; i < bgRects.length && !didMerge; i++) {
        for (let j = i + 1; j < bgRects.length && !didMerge; j++) {
          if (canMerge(bgRects[i], bgRects[j])) {
            bgRects.push({
              rootId: bgRects[i].rootId,
              x1: Math.min(bgRects[i].x1, bgRects[j].x1),
              y1: Math.min(bgRects[i].y1, bgRects[j].y1),
              x2: Math.max(bgRects[i].x2, bgRects[j].x2),
              y2: Math.max(bgRects[i].y2, bgRects[j].y2),
            });
            bgRects.splice(j, 1);
            bgRects.splice(i, 1);
            didMerge = true;
          }
        }
      }
    }

    bgRects.forEach((rect, i) => {
      updatedNodes.push({
        id: `__bg_${rect.rootId}_${i}__`,
        type: "topicBg",
        data: { color: rootColorMap[rect.rootId] || "#888" },
        position: { x: rect.x1, y: rect.y1 },
        style: { width: rect.x2 - rect.x1, height: rect.y2 - rect.y1, zIndex: -1 },
        draggable: false, selectable: false, connectable: false, zIndex: -1,
      });
    });

    Object.keys(positionedMap).forEach((id) => {
      const node = nodeMap[id];
      const isActive = activeNodeIds.includes(id);
      const nodeColor = rootColorMap[id] || rootColorMap[node.parent] || "#333";
      const rootId = nodeRootMap[id];
      const isNodeHighlighted = highlightedRootIds.size === 0 || highlightedRootIds.has(rootId);

      updatedNodes.push({
        id,
        type: "tooltipNode",
        data: { label: node.keyword, color: nodeColor, darkerColor: dullify(nodeColor, 0.35), isActive, isIndexHighlighted: isNodeHighlighted },
        position: positionedMap[id],
        sourcePosition: "right",
        targetPosition: "left",
      });
    });

    // 활성 노드 각각에서 루트까지의 경로 간선 ID를 수집
    const pathEdgeIds = new Set();
    activeNodeIds.forEach((nid) => {
      let current = nid;
      while (nodeMap[current]?.parent && nodeMap[nodeMap[current].parent]) {
        const parentId = nodeMap[current].parent;
        pathEdgeIds.add(`${parentId}-${current}`);
        current = parentId;
      }
    });

    const grayEdges = [];
    const coloredEdges = [];

    Object.values(nodeMap).forEach((node) => {
      if (!node?.parent || !nodeMap[node.parent]) return;

      const isActive = activeNodeIds.includes(node.id);
      const parentIsActive = activeNodeIds.includes(node.parent);
      const rootId = nodeRootMap[node.id];
      const isHighlighted = highlightedRootIds.size === 0 || highlightedRootIds.has(rootId);
      const isActiveEdge = isHighlighted && highlightedRootIds.size > 0;
      const edgeId = `${node.parent}-${node.id}`;
      const isPathEdge = pathEdgeIds.has(edgeId);
      const edgeColor = (isPathEdge || activeNodeIds.length === 0) ? (rootColorMap[rootId] || "#333") : "#BEBEBE";
      const edgeOpacity = contextMode && !(isActive || parentIsActive) ? 0.2 : 1;
      const strokeWidth = isPathEdge ? 4 : 2;

      const edge = {
        id: `${node.parent}-${node.id}`,
        source: node.parent,
        target: node.id,
        label: node.relation || "관련",
        type: "custom",
        animated: false,
        zIndex: isPathEdge ? 10 : 0,
        style: {
          strokeWidth,
          stroke: edgeColor,
          opacity: edgeOpacity,
          transition: "none",
        },
        data: { sourceId: node.parent, targetId: node.id, isActive, contextMode, activeNodeIds },
        labelStyle: { fontWeight: 600, fontSize: 14, opacity: edgeOpacity },
        markerEnd: { type: "arrowclosed", color: edgeColor },
      };

      if (isActiveEdge) {
        coloredEdges.push(edge);
      } else {
        grayEdges.push(edge);
      }
    });

    // 선택된 토픽 간선을 마지막에 배치해서 앞에 렌더링
    updatedEdges.push(...grayEdges, ...coloredEdges);

    setNodes(updatedNodes);
    setEdges(updatedEdges);
    dispatch(setNodeColors(rootColorMap));
  }, [nodesData, activeNodeIds, contextMode, selectedIndexNodeId, dispatch]);

  useEffect(() => {
    const measure = () => {
      const el = helpersInnerRef.current;
      setHelpersHeight(contextMode && el ? el.getBoundingClientRect().height : 0);
    };
    requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [contextMode, activeNodeIds.length, tokenUsed, tokenLimit]);

  useEffect(() => {
    if (!contextMode || !activeNodeIds?.length) {
      setTokenUsed(0);
      return;
    }

    let sum = 0;
    const seen = new Set();

    activeNodeIds.forEach((nid) => {
      const node = nodesData[nid];
      if (!node?.dialog) return;

      Object.entries(node.dialog).forEach(([dialogNumber, pair]) => {
        const key = `${nid}:${dialogNumber}`;
        if (seen.has(key)) return;
        seen.add(key);

        const { userMessage = "", gptMessage = "" } = pair || {};
        sum += estimateTurnTokens(userMessage, gptMessage);
      });
    });

    setTokenUsed(sum);
  }, [contextMode, activeNodeIds, nodesData]);

  return (
    <Page>
      <GraphPanel ref={containerRef}>
        <ToggleContainer>
          <ToggleButton active={contextMode} onToggle={handleToggle} />
        </ToggleContainer>
        {/* <VisContainer>
          <VisButton />
        </VisContainer> */}
        <ContextButton />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={isDraggable}
          elementsSelectable={true}
          onInteractiveChange={(isInteractive) => setIsDraggable(isInteractive)}
          fitView
        >
          <Background variant="dots" gap={20} size={1.5} color="#ddd" />
          <Controls />
        </ReactFlow>
      </GraphPanel>

      <SlideSection $h={helpersHeight} $open={contextMode}>
        <div ref={helpersInnerRef}>
          <HelperContainer>
            <TokenPanel>
              <PanelTitle>Token Info</PanelTitle>

              <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: '#373D47' }}>
                  {percent}%
                </span>
                <span style={{ color: status.color }}>{status.text}</span>
              </div>

              <ProgressBar>
                <div
                  className="fill"
                  style={{
                    width: `${percent}%`,
                    background: fillColor,
                  }}
                />
              </ProgressBar>

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
            <FixedKeywordsBox>
              {keywordChips.length === 0 ? (
                <div style={{ color: "#8A8F98", fontSize: 13 }}>
                  노드를 클릭/활성화하면 해당 노드의 키워드들이 여기에 표시됩니다.
                </div>
              ) : (
                <Chips>
                  {keywordChips.map(({ kw, nid, bg, fg }) => (
                    <Chip key={`${nid}:${kw}`} $bg={bg} $fg={fg}>
                      {kw}
                    </Chip>
                  ))}
                </Chips>
              )}
            </FixedKeywordsBox>
          </KeywordPanel>
          </HelperContainer>
        </div>
      </SlideSection>
    </Page>
  );
}

export default Graph;