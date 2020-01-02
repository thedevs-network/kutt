import { Flex } from "reflexbox/styled-components";
import styled from "styled-components";
import React, { FC } from "react";

import Animation from "./Animation";

interface Props extends React.ComponentProps<typeof Flex> {
  show: boolean;
  id?: string;
  closeHandler?: () => unknown;
}

const Wrapper = styled.div`
  position: fixed;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(50, 50, 50, 0.8);
  z-index: 1000;
`;

const Modal: FC<Props> = ({ children, id, show, closeHandler, ...rest }) => {
  if (!show) return null;

  const onClickOutside = e => {
    if (e.target.id === id) closeHandler();
  };

  return (
    <Wrapper id={id} onClick={onClickOutside}>
      <Animation
        offset="-20px"
        duration="0.2s"
        minWidth={[400, 450]}
        maxWidth={0.9}
        py={[32, 32, 48]}
        px={[24, 24, 32]}
        style={{ borderRadius: 8, backgroundColor: "white" }}
        flexDirection="column"
        {...rest}
      >
        {children}
      </Animation>
    </Wrapper>
  );
};

Modal.defaultProps = {
  show: false
};

export default Modal;
