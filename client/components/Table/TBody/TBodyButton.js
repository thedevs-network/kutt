import React from 'react';
import PropTypes from 'prop-types';
import styled, { css } from 'styled-components';

const Button = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 26px;
  height: 26px;
  margin: 0 12px 0 2px;
  padding: 0;
  border: none;
  outline: none;
  border-radius: 100%;
  box-shadow: 0 2px 4px rgba(100, 100, 100, 0.1);
  background-color: #dedede;
  cursor: pointer;
  transition: all 0.2s ease-out;

  @media only screen and (max-width: 768px) {
    height: 22px;
    width: 22px;
    margin: 0 8px 0 2px;

    img {
      width: 10px;
      height: 10px;
    }
  }

  ${({ withText }) =>
    withText &&
    css`
      width: auto;
      padding: 0 12px;
      border-radius: 100px;

      img {
        margin: 4px 6px 0 0;
      }

      @media only screen and (max-width: 768px) {
        width: auto;
      }
    `};

  :active,
  :focus {
    outline: none;
  }

  :hover {
    transform: translateY(-2px);
  }
`;

const TBodyButton = ({ children, withText, ...props }) => (
  <Button withText={withText} {...props}>
    {children}
  </Button>
);

TBodyButton.propTypes = {
  children: PropTypes.node.isRequired,
  withText: PropTypes.bool,
};

TBodyButton.defaultProps = {
  withText: null,
};

export default TBodyButton;
