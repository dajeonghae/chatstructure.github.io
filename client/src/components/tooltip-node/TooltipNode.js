import { memo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Handle, Position } from "reactflow";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { setHoveredNodes, clearHoveredNodes } from "../../redux/slices/modeSlice";
import { toggleActiveNode, toggleContextNode, setSelectedIndexNode } from "../../redux/slices/nodeSlice";
import { COLORS } from "../../styles/colors";
import { trackNodeInteraction } from "../../services/trackingService";

const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const NodeContent = styled.div`
  padding: 10px 20px;
  border-radius: 20px;
  background: ${(props) =>
    props.isContextActive
      ? "#606368"
      : props.isHovered
      ? "#A0AEC0"
      : "#fff"};
  color: ${(props) =>
    props.isContextActive
      ? "white"
      : props.isActive
      ? props.darkerColor || COLORS.dark_grey_font
      : COLORS.dark_grey_font};
  text-align: center;
  border: ${(props) =>
    props.isActive
      ? `2px solid ${props.borderColor || "#48BB78"}`
      : "1px solid #d9d9d9"};
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.3s;
  opacity: 1;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-weight: 600;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
  }
`;

const ContextMenu = styled.div`
  position: fixed;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.14);
  padding: 10px 14px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 140px;
`;

const MenuLabel = styled.div`
  font-size: 12px;
  color: #8a8f98;
  font-weight: 500;
`;

const MenuButtons = styled.div`
  display: flex;
  gap: 6px;
`;

const MenuBtn = styled.button`
  flex: 1;
  padding: 5px 0;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: ${(p) => (p.primary ? "#606368" : "#f1f3f5")};
  color: ${(p) => (p.primary ? "#fff" : "#575a5e")};
  &:hover {
    opacity: 0.85;
  }
`;

// 부모 노드를 모두 가져오는 함수
const getAllParentNodes = (nodeId, nodesData) => {
  let currentNode = nodesData[nodeId];
  const parentNodes = [];
  while (currentNode && currentNode.parent && currentNode.parent !== "root") {
    if (!nodesData[currentNode.parent]) break;
    parentNodes.push(currentNode.parent);
    currentNode = nodesData[currentNode.parent];
  }
  return parentNodes.reverse();
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
    currentNode.children.forEach((childId) => queue.push(childId));
  }
  return childNodes;
};

const TooltipNode = ({ data, id }) => {
  const dispatch = useDispatch();
  const linearMode = useSelector((state) => state.mode.linearMode);
  const treeMode = useSelector((state) => state.mode.treeMode);
  const hoveredNodeIds = useSelector((state) => state.mode.hoveredNodeIds);
  const activeNodeIds = useSelector((state) => state.node.activeNodeIds);
  const contextNodeIds = useSelector((state) => state.node.contextNodeIds) || [];
  const nodesData = useSelector((state) => state.node.nodes);

  const isHovered = hoveredNodeIds.includes(id);
  const isActive = activeNodeIds.includes(id);
  const isContextActive = contextNodeIds.includes(id);
  const hasAnyContext = contextNodeIds.length > 0;

  const [menu, setMenu] = useState(null); // { x, y }
  const menuRef = useRef(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!menu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menu]);

  const handleMouseEnter = () => {
    if (linearMode) {
      const parentNodes = getAllParentNodes(id, nodesData);
      dispatch(setHoveredNodes([...parentNodes, id]));
    } else if (treeMode) {
      dispatch(setHoveredNodes(getAllChildNodes(id, nodesData)));
    }
  };

  const handleMouseLeave = () => {
    if (linearMode || treeMode) dispatch(clearHoveredNodes());
  };

  const handleClick = (event) => {
    event.stopPropagation();
    if (menu) { setMenu(null); return; }
    trackNodeInteraction();
    if ((linearMode || treeMode) && hoveredNodeIds.length > 0) {
      const allAlreadyActive = hoveredNodeIds.every((id) => activeNodeIds.includes(id));
      if (allAlreadyActive) {
        hoveredNodeIds.forEach((id) => dispatch(toggleActiveNode(id)));
      } else {
        dispatch(setSelectedIndexNode(null));
        activeNodeIds.forEach((id) => dispatch(toggleActiveNode(id)));
        hoveredNodeIds.forEach((id) => dispatch(toggleActiveNode(id)));
      }
    } else {
      dispatch(setSelectedIndexNode(null));
      if (!isActive) {
        activeNodeIds.forEach((activeId) => dispatch(toggleActiveNode(activeId)));
      }
      dispatch(toggleActiveNode(id));
    }
  };

  const handleRightClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY });
  };

  const handleConfirm = () => {
    dispatch(toggleContextNode(id));
    setMenu(null);
  };

  return (
    <TooltipContainer onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={handleClick} onContextMenu={handleRightClick}>
      <NodeContent isHovered={isHovered} isActive={isActive} isContextActive={isContextActive} hasAnyContext={hasAnyContext} borderColor={data.color} darkerColor={data.darkerColor}>
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
      {menu && createPortal(
        <ContextMenu ref={menuRef} style={{ left: menu.x, top: menu.y }}>
          <MenuLabel>{isContextActive ? "컨텍스트에서 제거할까요?" : "컨텍스트에 추가할까요?"}</MenuLabel>
          <MenuButtons>
            <MenuBtn primary onClick={handleConfirm}>
              {isContextActive ? "빼기" : "넣기"}
            </MenuBtn>
            <MenuBtn onClick={() => setMenu(null)}>취소</MenuBtn>
          </MenuButtons>
        </ContextMenu>,
        document.body
      )}
    </TooltipContainer>
  );
};

export default memo(TooltipNode);
