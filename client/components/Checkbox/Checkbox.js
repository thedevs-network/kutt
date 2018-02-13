import React from 'react';
import PropTypes from 'prop-types';
import styled, { css } from 'styled-components';

const Wrapper = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin: 24px 32px 24px 0;
`;

const Box = styled.span`
  position: relative;
  display: flex;
  align-items: center;
  font-weight: normal;
  color: #666;
  transition: color 0.3s ease-out;
  cursor: pointer;

  :hover {
    color: black;
  }
  :before {
    content: '';
    display: block;
    width: 18px;
    height: 18px;
    margin-right: 10px;
    border-radius: 4px;
    background-color: white;
    box-shadow: 0 2px 4px rgba(50, 50, 50, 0.2);
    cursor: pointer;

    @media only screen and (max-width: 768px) {
      width: 14px;
      height: 14px;
      margin-right: 8px;
    }
  }

  ${({ checked }) =>
    checked &&
    css`
      :before {
        box-shadow: 0 3px 5px rgba(50, 50, 50, 0.4);
      }
      :after {
        content: '';
        position: absolute;
        left: 2px;
        top: 4px;
        width: 14px;
        height: 14px;
        display: block;
        margin-right: 10px;
        border-radius: 2px;
        background-color: #9575cd;
        box-shadow: 0 2px 4px rgba(50, 50, 50, 0.2);
        cursor: pointer;

        @media only screen and (max-width: 768px) {
          left: 2px;
          top: 5px;
          width: 10px;
          height: 10px;
        }
      }
    `};
`;

const Checkbox = ({ checked, label, id, onClick }) => (
  <Wrapper>
    <Box checked={checked} id={id} onClick={onClick}>
      {label}
    </Box>
  </Wrapper>
);

Checkbox.propTypes = {
  checked: PropTypes.bool,
  label: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  onClick: PropTypes.func,
};

Checkbox.defaultProps = {
  checked: false,
  onClick: f => f,
};

export default Checkbox;
