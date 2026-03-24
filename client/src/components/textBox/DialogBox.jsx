import { useState } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { COLORS } from "../../styles/colors.jsx";
import { useSelector } from "react-redux";

const Container = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: ${(props) => (props.isUser ? 'flex-end' : 'flex-start')};
    margin: 6px;
    position: relative;
`;

const MessageBubble = styled.div`
    display: flex;
    flex-direction: column;
    padding: 5px 20px;
    margin: 10px 0px;
    border-radius: ${(props) => (props.isUser ? '30px 30px 0px 30px' : '0px 30px 30px 30px')};
    background-color: ${(props) => {
        if (props.isActive) {
          if (props.isUser) {
            return props.isScrolled
                ? `${props.activeColor}66`
                : `${props.activeColor}44`;
          } else {
            return props.isScrolled
            ? `${props.activeColor}0A`
            : `${props.activeColor}0A`;
            }
        }

        if (props.isContextMode) {
          return props.isUser ? 'rgba(240, 240, 240, 0.5)' : 'transparent';
        }

        return props.isUser ? '#f5f5f5' : '#fff';
      }};
    color: '#343942';
    opacity: 1;
    border: ${(props) => {
        if (!props.isUser && props.isActive) {
          const color = props.activeColor || '#2C7A7B';
          return `1.5px solid ${color}44`;
        }
        return props.isUser ? 'none' : '1px solid rgba(217, 217, 217, 0.5)';
      }};
    word-wrap: break-word;
    text-align: left;
    transition: all 0.3s ease;
    transform: ${(props) => (props.isActive && props.isScrolled ? 'scale(1.01)' : 'scale(1)')};
    box-shadow: ${(props) => (props.isActive && props.isScrolled ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none')};
`;

const LabelContainer = styled.div`
    display: flex;
    flex-direction: row;
    gap: 4px;
    align-items: center;
`;

const Label = styled.div`
    font-size: 14px;
    color: ${COLORS.basic_font};
`;

const AttachmentsRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
    margin-bottom: 4px;
    margin-right: 6px;
`;

const AttachedImage = styled.img`
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: 12px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: zoom-in;
    transition: opacity 0.15s;
    &:hover { opacity: 0.85; }
`;

const AttachedPdfBadge = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 8px;
    background-color: #f5f5f5;
    border: 1px solid rgba(0, 0, 0, 0.1);
    font-size: 12px;
    color: #444;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background-color: #ebebeb; }
`;

/* ── 모달 공통 ── */
const ModalOverlay = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.82);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const CloseButton = styled.button`
    position: fixed;
    top: 20px;
    right: 24px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.15);
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    &:hover { background: rgba(255,255,255,0.28); }
`;

/* ── 이미지 뷰어 ── */
const LightboxImage = styled.img`
    max-width: 90vw;
    max-height: 90vh;
    border-radius: 8px;
    object-fit: contain;
    box-shadow: 0 8px 40px rgba(0,0,0,0.5);
`;

/* ── PDF 뷰어 ── */
const PdfModal = styled.div`
    width: 92vw;
    height: 95vh;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
`;

const PdfHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid #eee;
    font-size: 14px;
    font-weight: 600;
    color: #333;
    flex-shrink: 0;
`;

const PdfFrame = styled.iframe`
    flex: 1;
    width: 100%;
    border: none;
`;

const PdfNoData = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #888;
    font-size: 14px;
`;

const DialogBox = ({ text, isUser, nodeId, number, attachments }) => {
    const [modal, setModal] = useState(null); // { type: 'image'|'pdf', src, name }

    const nodes = useSelector((state) => state.node.nodes);
    const activeDialogNumbers = useSelector((state) => state.node.activeDialogNumbers);
    const contextDialogNumbers = useSelector((state) => state.node.contextDialogNumbers) || [];
    const currentScrolledDialog = useSelector((state) => state.node.currentScrolledDialog);
    const nodeColors = useSelector((state) => state.node.nodeColors);
    const isActive = activeDialogNumbers.includes(number);
    const isContextActive = contextDialogNumbers.includes(number);
    const hasAnyContext = contextDialogNumbers.length > 0;
    const isScrolled = currentScrolledDialog === number;

    let actualNodeId = "root";
    Object.entries(nodes).forEach(([id, node]) => {
        Object.keys(node.dialog).forEach((dialogNumStr) => {
            const dialogNum = Number(dialogNumStr);
            const questionNum = (dialogNum - 1) * 2 + 1;
            const answerNum = (dialogNum - 1) * 2 + 2;
            if (number === questionNum || number === answerNum) {
                actualNodeId = id;
            }
        });
    });

    const activeColor = nodeColors[actualNodeId];

    const openModal = (att) => {
        let src = att.preview || null;
        if (att.type === 'pdf' && src && src.startsWith('data:')) {
            try {
                const base64 = src.split(',')[1];
                const binary = atob(base64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: 'application/pdf' });
                src = URL.createObjectURL(blob);
            } catch (e) {
                console.warn('PDF blob 변환 실패:', e);
                src = null;
            }
        }
        setModal({ type: att.type, src, name: att.name });
    };

    const closeModal = () => {
        if (modal?.type === 'pdf' && modal?.src?.startsWith('blob:')) {
            URL.revokeObjectURL(modal.src);
        }
        setModal(null);
    };

    return (
        <>
        <Container isUser={isUser} style={{ flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
            {attachments?.length > 0 && (
                <AttachmentsRow>
                    {attachments.map((att, i) =>
                        att.type === 'image' ? (
                            <AttachedImage
                                key={i}
                                src={att.preview}
                                alt={att.name}
                                onClick={() => openModal(att)}
                            />
                        ) : (
                            <AttachedPdfBadge key={i} onClick={() => openModal(att)}>
                                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#e74c3c' }}>picture_as_pdf</span>
                                {att.name}
                            </AttachedPdfBadge>
                        )
                    )}
                </AttachmentsRow>
            )}
            <MessageBubble isUser={isUser} isActive={isActive} isScrolled={isScrolled} isContextMode={hasAnyContext} isContextActive={isContextActive} activeColor={activeColor}>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {isUser ? text.replace(/\n/g, '  \n') : text}
                </ReactMarkdown>
            </MessageBubble>
        </Container>

        {modal && (
            <ModalOverlay onClick={closeModal}>
                <CloseButton onClick={closeModal}>✕</CloseButton>
                {modal.type === 'image' ? (
                    <LightboxImage
                        src={modal.src}
                        alt={modal.name}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <PdfModal onClick={(e) => e.stopPropagation()}>
                        <PdfHeader>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#e74c3c' }}>picture_as_pdf</span>
                            {modal.name}
                        </PdfHeader>
                        {modal.src ? (
                            <PdfFrame src={modal.src} title={modal.name} />
                        ) : (
                            <PdfNoData>
                                <span className="material-symbols-outlined" style={{ fontSize: 40, color: '#ccc' }}>picture_as_pdf</span>
                                <span>PDF는 현재 세션에서만 볼 수 있습니다</span>
                                <span style={{ fontSize: 12 }}>(페이지 새로고침 후에는 미리보기 불가)</span>
                            </PdfNoData>
                        )}
                    </PdfModal>
                )}
            </ModalOverlay>
        )}
        </>
    );
};

export default DialogBox;
