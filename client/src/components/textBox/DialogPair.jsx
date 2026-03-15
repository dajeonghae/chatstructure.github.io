import React from 'react';
import styled from 'styled-components';
import { useSelector } from 'react-redux';
import DialogBox from './DialogBox'; // 경로 확인 필요

// 전체 컨테이너
const PairContainer = styled.div`
    display: flex;
    flex-direction: row; /* 가로 배치 */
    width: 100%;
    position: relative;
    margin-bottom: 20px; /* 대화 쌍 간의 간격 */
`;

// 1. 왼쪽: 실제 대화 메시지 영역
const MessagesContainer = styled.div`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    width: calc(100% - 70px); /* 타임라인 너비만큼 뺌 */
    padding-right: 15px;      /* 타임라인과 메시지 사이 간격 */
`;

// 2. 오른쪽: 타임라인 인덱스 영역
const TimelineContainer = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center; /* 수직선과 동그라미 가운데 정렬 */
    width: 70px;         /* 타임라인 영역 고정 너비 */
    flex-shrink: 0;
    position: relative;
    padding-top: 10px;   /* 첫 메시지와 라벨 높이 맞춤 */
`;

// 세로선 (TimelineContainer 내부에서 가운데 정렬)
const VerticalLine = styled.div`
    position: absolute;
    top: 30px;    /* 동그라미 아래부터 시작 */
    bottom: -20px;/* 다음 대화 쌍까지 선 이어지게 */
    left: 50%;    /* 영역의 정중앙 */
    transform: translateX(-50%);
    width: 2px;
    background-color: ${(props) => props.color || '#d9d9d9'};
    opacity: 0.5;
    z-index: 1;
`;

// 노드 원형 포인트
const NodeCircle = styled.div`
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: white;
    border: 3px solid ${(props) => props.color || '#d9d9d9'};
    z-index: 2;
    margin-bottom: 4px;
`;

// 노드 ID 뱃지 (라벨)
const NodeBadge = styled.div`
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 700;
    color: ${(props) => props.color || '#666'};
    background-color: ${(props) => props.color ? `${props.color}1A` : '#f5f5f5'};
    border: 1px solid ${(props) => props.color ? `${props.color}4D` : '#ddd'};
    z-index: 2;
    text-align: center;
    word-break: break-all;
    max-width: 60px;
    line-height: 1.2;
`;

const DialogPair = ({ userMsg, aiMsg, userRef, aiRef }) => {
    const nodes = useSelector((state) => state.node.nodes);
    const nodeColors = useSelector((state) => state.node.nodeColors);

    // Node ID 역추적 로직
    let actualNodeId = userMsg?.nodeId || "root";
    if (nodes) {
        Object.entries(nodes).forEach(([id, node]) => {
            Object.keys(node.dialog || {}).forEach((dialogNumStr) => {
                const dialogNum = Number(dialogNumStr);
                const questionNum = (dialogNum - 1) * 2 + 1;
                // userMsg의 number와 매칭되는 노드 찾기
                if (userMsg?.number === questionNum) {
                    actualNodeId = id;
                }
            });
        });
    }

    const activeColor = nodeColors?.[actualNodeId] || '#A0AEC0';

    return (
        <PairContainer>
            {/* 1. 메시지 영역을 먼저 렌더링 (왼쪽) */}
            <MessagesContainer>
                {/* User 메시지 */}
                {userMsg && (
                    <div ref={userRef} style={{ width: '100%', marginBottom: '8px' }}>
                        <DialogBox
                            text={userMsg.content}
                            isUser={true}
                            nodeId={actualNodeId}
                            number={userMsg.number}
                        />
                    </div>
                )}
                
                {/* AI 메시지 */}
                {aiMsg && (
                    <div ref={aiRef} style={{ width: '100%' }}>
                        <DialogBox
                            text={aiMsg.content}
                            isUser={false}
                            nodeId={actualNodeId}
                            number={aiMsg.number}
                        />
                    </div>
                )}
            </MessagesContainer>

            {/* 2. 타임라인 영역을 나중에 렌더링 (오른쪽)
            <TimelineContainer>
                <NodeCircle color={activeColor} />
                <NodeBadge color={activeColor}>{actualNodeId}</NodeBadge>
                <VerticalLine color={activeColor} />
            </TimelineContainer> */}
        </PairContainer>
    );
};

export default DialogPair;