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
const nodeTypes = { tooltipNode: CustomTooltipNode };

const TOKEN_LIMIT = 15900;

const colorPalette = [
  "#A9DED3", "#FFD93D", "#EC7FA0", "#98E4FF", "#D1A3FF",
  "#6BCB77", "#FF914D", "#93AFEA", "#FFB6C1"
];

// 팔레트에서 인덱스로 색을 고르는 유틸
function getColor(index) {
  return colorPalette[index % colorPalette.length];
}

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
  background: #FCFCFC;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
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

/* ── ProgressBar: 채워진 부분 색을 동적으로 바꿉니다 ─────────────── */
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
  padding: ${(p) => (p.$open ? "8px 0" : "0")};
  box-sizing: content-box;
  transition:
    height 280ms ease,
    padding 280ms ease,
    opacity 220ms ease,
    transform 280ms ease;
  opacity: ${(p) => (p.$open ? 1 : 0)};
  transform: translateY(${(p) => (p.$open ? "0px" : "8px")});
`;

function getReadableTextColor(hex = "#000000") {
try {
  const x = hex.replace("#", "");
  const r = parseInt(x.substring(0, 2), 16);
  const g = parseInt(x.substring(2, 4), 16);
  const b = parseInt(x.substring(4, 6), 16);
  const yiq = (r*299 + g*587 + b*114) / 1000;
  return yiq >= 140 ? "#111" : "#fff";
} catch { return "#111"; }
}

/* 색상 보간(검붉은색 → 빨강). 입력은 hex, 0<=t<=1 */
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

/* 퍼센트에 따라 채움 색(단색) 계산: <85% 회색, 85~95% 검붉은→빨강, >=95% 빨강 */
function getFillColor(percent) {
  const base = "#575A5E";   // 기본(회색)
  const dark = "#7F1D1D";   // 검붉은 시작색
  const danger = "#E11D48"; // 빨강 끝색

  if (percent < 85) return base;
  if (percent >= 95) return danger;

  // 85~95% 사이 단색 보간
  const t = (percent - 85) / (95 - 85); // 0~1
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

// 글자색: 노드색을 약간 탁하게 (검정이랑 50% 정도 섞기)
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

  const [helpersHeight, setHelpersHeight] = useState(0);
  const helpersInnerRef = useRef(null);

  const [tokenUsed, setTokenUsed] = useState(0);
  const tokenLimit = TOKEN_LIMIT;
  const percent = Math.min(100, Math.round((tokenUsed / tokenLimit) * 100));

  // 경고/상태 문구
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

  const handleToggle = () => dispatch(toggleContextMode());

  const keywordChips = useMemo(() => {
    // 같은 키워드는 하나만 노출 (첫 등장의 색/노드 사용)
    const seen = new Map(); // normKw -> { kw, nid, bg, fg }
    activeNodeIds.forEach((nid) => {
      const node = nodesData[nid];
      if (!node) return;

      const base = (nodeColors && nodeColors[nid]) || "#E2F0CB";
      const chipBg = hexWithAlpha(base, 0.25); // 배경: 노드색 + 투명도
      const chipFg = dullify(base, 0.6);       // 글자: 노드색을 약간 탁하게

      const kws = Array.isArray(node.keywords) ? node.keywords : [];
      kws.forEach((kw) => {
        const norm = normalizeKeyword(kw);
        if (!norm) return;
        // 이미 본 키워드는 스킵 (먼저 본 색/노드 유지)
        if (!seen.has(norm)) {
          seen.set(norm, { kw, nid, bg: chipBg, fg: chipFg });
        }
      });
    });

    // 입력 순서(활성 노드 순서 -> 키워드 순서) 보존
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

              {/* 헤더: % + 상태문구(색상 동적) */}
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
                    background: fillColor,  // ← 단색
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
