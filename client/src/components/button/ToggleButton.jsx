import React from "react";
import styled from "styled-components";

const ToggleWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ToggleSwitch = styled.div`
  width: 50px;
  height: 25px;
  border-radius: 50px;
  background-color: ${(props) => (props.active ? "#373D47" : "#ccc")};
  position: relative;
  cursor: pointer;
  transition: background-color 0.3s ease;
`;

const ToggleCircle = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: white;
  position: absolute;
  top: 1.5px;
  left: ${(props) => (props.active ? "26px" : "2px")};
  transition: left 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const ToggleLabel = styled.span`
  font-size: 16px;
  font-weight: bold;
`;

const ToggleButton = ({ active, onToggle }) => {
  return (
    <ToggleWrapper onClick={onToggle}>
      <ToggleSwitch active={active}>
        <ToggleCircle active={active} />
      </ToggleSwitch>
      <ToggleLabel>Context Management</ToggleLabel>
    </ToggleWrapper>
  );
};

export default ToggleButton;
