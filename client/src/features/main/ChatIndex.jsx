import { useState } from "react";
import { useDispatch } from "react-redux";
import { setSelectedIndexNode } from "../../redux/slices/nodeSlice";
import styled from "styled-components";

const IndexWrapper = styled.div`
  width: 220px;
  align-self: stretch;
  flex-shrink: 0;
  padding: 28px 0 28px 20px;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  border-left: 1.5px solid #E8EAED;
  overflow: visible;
  box-shadow: 18px 0px 24px -10px rgba(149, 157, 165, 0.15);
  z-index: 10;
  position: relative;
`;

const Track = styled.div`
  position: relative;
  width: 2px;
  height: 100%;
  background-color: #EAECEF;
  border-radius: 1px;
  flex-shrink: 0;
`;

const SegmentHighlight = styled.div`
  position: absolute;
  left: 0;
  width: 2px;
  border-radius: 1px;
  background-color: ${(props) => props.color};
  z-index: 1;
  opacity: 0.85;
`;

const MarkerRow = styled.div`
  position: absolute;
  left: -5px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  z-index: 5;

  &:hover span {
    color: ${(props) => props.$color};
    opacity: 1;
  }

  &:hover div {
    background-color: ${(props) => props.$color};
    opacity: 1;
  }
`;

const TopicMarker = styled.div`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${(props) => props.$selected ? props.$color : "#C8CDD4"};
  transition: background-color 0.2s ease, transform 0.2s ease;
  transform: ${(props) => props.$selected ? "scale(1.3)" : "scale(1)"};
`;

const TopicLabel = styled.span`
  font-size: 11px;
  font-weight: ${(props) => props.$selected ? "700" : "400"};
  color: ${(props) => props.$selected ? props.$color : "#9AA0A8"};
  white-space: nowrap;
  pointer-events: none;
  transition: color 0.2s ease, font-weight 0.2s ease;
  letter-spacing: -0.01em;
`;

const ProgressDot = styled.div`
  position: absolute;
  left: 50%;
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
        <ProgressDot style={{ top: `${scrollPercent}%` }} />

        {segmentRanges.map((seg, i) => (
          <SegmentHighlight
            key={i}
            style={{ top: `${seg.top}%`, height: `${seg.height}%` }}
            color={selectedMarker.color}
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
