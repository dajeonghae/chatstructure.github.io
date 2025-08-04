import React from "react";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { setVisMode } from "../../redux/slices/modeSlice";
import VisModal from "../../features/modal/VisModal";

const VisualizationButton = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 10px 15px 10px 12px;
  background: ${(props) => (props.active ? "#373D47" : "#ffffff")};
  color: ${(props) => (props.active ? "#fff" : "#000")};
  border: 1px solid ${(props) => (props.active ? "#373D47" : "#D9D9D9")};
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  gap: 7px;

  &:hover {
    background: ${(props) => (props.active ? "#4A515E" : "#eee")};
    border: 1px solid ${(props) => (props.active ? "#4A515E" : "#D9D9D9")};
    transition: background 0.2s, color 0.2s;
  }

  .material-symbols-outlined {
    color: ${(props) => (props.active ? "#fff" : "#000")}; /* 아이콘 색상도 active에 따라 변경 */
  }
`;

const VisButton = () => {
  const dispatch = useDispatch();
  const isOpen = useSelector((state) => state.mode.isVisMode);

  const handleClick = () => {
    console.log("History Visualization 버튼 클릭됨");
    dispatch(setVisMode(true));
  };

  const handleClose = () => {
    dispatch(setVisMode(false));
  };

  return (
    <>
        <VisualizationButton onClick={handleClick}>
            <span className="material-symbols-outlined md-black-font md-18">
                graph_5
            </span>
            History Visualization
        </VisualizationButton>   
        <VisModal isOpen={isOpen} onClose={handleClose}>

        </VisModal> 
    </>
  );
};

export default VisButton;
