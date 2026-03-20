import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { setSelectedIndexNode } from "../../redux/slices/nodeSlice";
import styled from "styled-components";

const IndexWrapper = styled.div`
  width: 270px;
  align-self: stretch;
  flex-shrink: 0;
  padding: 28px 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border-left: 1.5px solid #E8EAED;
  overflow: visible;
  box-shadow: 18px 0px 24px -10px rgba(149, 157, 165, 0.15);
  z-index: 10;
  position: relative;
`;

const Track = styled.div`
  position: relative;
  width: 3px; 
  height: 90%;
  flex-shrink: 0;
`;

const TrackSegment = styled.div`
  position: absolute;
  left: -2px;
  width: 3px; 
  border-radius: 1.5px;
  background-color: #D9DCDF;
`;

const SegmentHighlight = styled.div`
  position: absolute;
  left: -4px; 
  width: 6px; 
  border-radius: 3px; 
  background-color: ${(props) => props.color};
  z-index: 1;
  
  /* 위치(top)는 고정되어 있으므로 height만 스르륵 길어지도록 설정 */
  /* transform-origin을 설정하지 않아도 top 기준이므로 기본적으로 아래로 자라납니다 */
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.4s ease;
`;

const MarkerRow = styled.div`
  position: absolute;
  left: -6px; 
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  z-index: 5;

  &:hover span {
    color: ${(props) => props.$color};
  }

  &:hover > div {
    border-color: ${(props) => props.$color};
  }
`;

const TopicMarker = styled.div`
  box-sizing: border-box;
  width: ${(props) => props.$selected ? "5px" : "12px"}; 
  height: ${(props) => props.$selected ? "5px" : "12px"};
  margin: ${(props) => props.$selected ? "3px" : "0"};
  
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${(props) => props.$selected ? props.$color : "#fff"};
  border: ${(props) => props.$selected ? "none" : "3px solid #C8CDD4"};
  box-shadow: ${(props) => props.$selected ? "none" : "0 0 0 4px #fff"};
  transition: all 0.2s ease;
`;

const TopicLabel = styled.span`
  padding: 6px 14px;
  border-radius: 20px;
  background: #fff;
  color: ${(props) => props.$selected ? props.$color : "#606368"};
  box-shadow: 0 2px 8px 0 rgba(99, 99, 99, 0.1);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  transition: color 0.2s ease, border-color 0.2s ease;
  letter-spacing: -0.01em;
`;

const ProgressDot = styled.div`
  position: absolute;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #c92a2a;
  transition: top 0.1s ease-out;
  z-index: 10;
  left: -1px; 
  box-shadow: 0 0 0 2px #fff, 0 0 0 3px #c92a2a;
`;

const ChatIndex = ({ scrollPercent, markers = [], onMarkerClick }) => {
  const dispatch = useDispatch();
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // 애니메이션 포인트 2: 현재 그려지고 있는 트랙들의 상태를 관리하는 새로운 State
  const [animatingSegments, setAnimatingSegments] = useState([]);

  // 애니메이션 포인트 3: 클릭한 마커가 바뀔 때마다 애니메이션 트리거
useEffect(() => {
    setAnimatingSegments([]);
    
    const newSelectedMarker = markers.find((m) => m.nodeId === selectedNodeId);
    
    if (newSelectedMarker) {
      const color = newSelectedMarker.color;
      
      // A. 시작 상태: 각 영역의 '원래 시작점(top)'에서 '높이 0'으로 시작
      const initialStates = newSelectedMarker.segments.map((s, i) => ({
        key: `${newSelectedMarker.nodeId}-${i}`,
        color,
        top: s.topPercent, // 마커 위치가 아닌, 각 영역의 시작점!
        height: 0,         // 처음엔 보이지 않음 (높이 0)
      }));
      
      setAnimatingSegments(initialStates);
      
      // B. 도착 상태: 리액트 렌더링 직후 높이를 원래 크기로 주욱 늘림
      setTimeout(() => {
        const finalStates = newSelectedMarker.segments.map((s, i) => ({
          key: `${newSelectedMarker.nodeId}-${i}`,
          color,
          top: s.topPercent, // 위치는 그대로 고정
          height: Math.max((s.bottomPercent ?? s.topPercent) - s.topPercent, 0.5), // 원래 높이로 쭈욱 늘어남!
        }));
        
        setAnimatingSegments(finalStates);
      }, 10);
    }
  }, [selectedNodeId, markers]);

  // 회색 트랙 세그먼트 계산 로직 (동일)
  const trackSegments = (() => {
    const percents = [...markers].sort((a, b) => a.topPercent - b.topPercent).map(m => m.topPercent);
    if (percents.length === 0) return [{ top: 0, height: 100 }];
    
    const segs = [];
    const addSeg = (start, end) => {
      segs.push({ top: start, height: end - start }); 
    };
    
    addSeg(0, percents[0]);
    for (let i = 0; i < percents.length - 1; i++) addSeg(percents[i], percents[i + 1]);
    addSeg(percents[percents.length - 1], 100);
    
    return segs;
  })();

  const handleMarkerClick = (marker) => {
    if (selectedNodeId === marker.nodeId) {
      setSelectedNodeId(null);
      dispatch(setSelectedIndexNode(null));
    } else {
      setSelectedNodeId(marker.nodeId);
      dispatch(setSelectedIndexNode(marker.nodeId));
      onMarkerClick?.(marker.messageIndex);
    }
  };

  return (
    <IndexWrapper>
      <Track>
        {trackSegments.map((seg, i) => (
          <TrackSegment key={i} style={{ top: `${seg.top}%`, height: `${seg.height}%` }} />
        ))}
        <ProgressDot style={{ top: `${scrollPercent}%` }} />

        {/* 애니메이션 포인트 4: segmentRanges 대신 animatingSegments state를 렌더링 */}
        {animatingSegments.map((seg) => (
          <SegmentHighlight
            key={seg.key} // 고유 키 사용
            style={{ top: `${seg.top}%`, height: `${seg.height}%` }}
            color={seg.color}
          />
        ))}

        {markers.map((marker) => {
          const isSelected = selectedNodeId === marker.nodeId;
          return (
            <MarkerRow
              key={marker.nodeId}
              style={{ top: `${marker.topPercent}%` }}
              onClick={() => handleMarkerClick(marker)}
              $color={marker.color}
            >
              <TopicMarker $color={marker.color} $selected={isSelected} />
              <TopicLabel $color={marker.color} $selected={isSelected}>
                {marker.keyword}
              </TopicLabel>
            </MarkerRow>
          );
        })}
      </Track>
    </IndexWrapper>
  );
};

export default ChatIndex;