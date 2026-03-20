import { useState } from "react";
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
  /* 선 굵기를 3px로 증가 */
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
  /* MarkerRow의 left(-6px)에서 왼쪽 테두리(3px)만큼 들어간 위치 */
  left: -3px; 
  /* 전체 12px에서 양쪽 테두리 6px을 뺀 순수 내부 너비 */
  width: 6px; 
  /* 알약 모양을 위해 너비의 절반값을 radius로 설정 */
  border-radius: 3px; 
  background-color: ${(props) => props.color};
  z-index: 1;
  opacity: 1; /* 사진처럼 진하게 물들게 하려면 1 (기존처럼 살짝 투명하게 하려면 0.85 유지) */
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
  width: ${(props) => props.$selected ? "6px" : "12px"}; 
  height: ${(props) => props.$selected ? "6px" : "12px"};
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
  left: 1.5px; 
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #c92a2a;
  transition: top 0.1s ease-out;
  z-index: 10;
  box-shadow: 0 0 0 2px #fff, 0 0 0 3px #c92a2a;
`;

const ChatIndex = ({ scrollPercent, markers = [], onMarkerClick }) => {
  const dispatch = useDispatch();
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const selectedMarker = markers.find((m) => m.nodeId === selectedNodeId);

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

  const segmentRanges = (() => {
    const segs = selectedMarker?.segments;
    if (!segs || segs.length === 0) return [];
    return segs.map((s) => ({
      top: s.topPercent,
      height: Math.max((s.bottomPercent ?? s.topPercent) - s.topPercent, 0.5),
    }));
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

        {segmentRanges.map((seg, i) => (
          <SegmentHighlight
            key={i}
            style={{ top: `${seg.top}%`, height: `${seg.height}%` }}
            color={selectedMarker?.color}
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