import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import Button from '../Button';

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

const Content = styled.div`
  padding: 48px 64px;
  text-align: center;
  border-radius: 8px;
  background-color: white;

  @media only screen and (max-width: 768px) {
    width: 90%;
    padding: 32px;
  }
`;

const ButtonsWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 40px;
  button {
    margin: 0 16px;
  }
`;

const Modal = ({ children, handler, show, close }) =>
  show ? (
    <Wrapper>
      <Content>
        {children}
        <ButtonsWrapper>
          <Button color="gray" onClick={close}>
            No
          </Button>
          <Button onClick={handler}>Yes</Button>
        </ButtonsWrapper>
      </Content>
    </Wrapper>
  ) : null;

Modal.propTypes = {
  children: PropTypes.node.isRequired,
  close: PropTypes.func.isRequired,
  handler: PropTypes.func.isRequired,
  show: PropTypes.bool,
};

Modal.defaultProps = {
  show: false,
};

export default Modal;
