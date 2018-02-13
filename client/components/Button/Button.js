import React from 'react';
import PropTypes from 'prop-types';
import styled, { css } from 'styled-components';
import SVG from 'react-inlinesvg';
import { spin } from '../../helpers/animations';

const StyledButton = styled.button`
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0px 32px;
  font-size: 13px;
  font-weight: normal;
  text-align: center;
  line-height: 1;
  word-break: keep-all;
  color: white;
  background: linear-gradient(to right, #42a5f5, #2979ff);
  box-shadow: 0 5px 6px rgba(66, 165, 245, 0.5);
  border: none;
  border-radius: 100px;
  transition: all 0.4s ease-out;
  cursor: pointer;
  overflow: hidden;

  :hover,
  :focus {
    outline: none;
    box-shadow: 0 6px 15px rgba(66, 165, 245, 0.5);
    transform: translateY(-2px) scale(1.02, 1.02);
  }

  a & {
    text-decoration: none;
    border: none;
  }

  @media only screen and (max-width: 448px) {
    height: 32px;
    padding: 0 24px;
    font-size: 12px;
  }

  ${({ color }) => {
    if (color === 'purple') {
      return css`
        background: linear-gradient(to right, #7e57c2, #6200ea);
        box-shadow: 0 5px 6px rgba(81, 45, 168, 0.5);

        :focus,
        :hover {
          box-shadow: 0 6px 15px rgba(81, 45, 168, 0.5);
        }
      `;
    }
    if (color === 'gray') {
      return css`
        color: black;
        background: linear-gradient(to right, #e0e0e0, #bdbdbd);
        box-shadow: 0 5px 6px rgba(160, 160, 160, 0.5);

        :focus,
        :hover {
          box-shadow: 0 6px 15px rgba(160, 160, 160, 0.5);
        }
      `;
    }
    return null;
  }};

  ${({ big }) =>
    big &&
    css`
      height: 56px;
      @media only screen and (max-width: 448px) {
        height: 40px;
      }
    `};
`;

const Icon = styled(SVG)`
  svg {
    width: 16px;
    height: 16px;
    margin-right: 12px;
    stroke: #fff;

    ${({ type }) =>
      type === 'loader' &&
      css`
        width: 20px;
        height: 20px;
        margin: 0;
        animation: ${spin} 1s linear infinite;
      `};

    ${({ round }) =>
      round &&
      css`
        width: 15px;
        height: 15px;
        margin: 0;
      `};

    ${({ color }) =>
      color === 'gray' &&
      css`
        stroke: #444;
      `};

    @media only screen and (max-width: 768px) {
      width: 12px;
      height: 12px;
      margin-right: 6px;
    }
  }
`;

const Button = props => {
  const SVGIcon = props.icon ? (
    <Icon
      type={props.icon}
      round={props.round}
      color={props.color}
      src={`/images/${props.icon}.svg`}
    />
  ) : (
    ''
  );
  return (
    <StyledButton {...props}>
      {SVGIcon}
      {props.icon !== 'loader' && props.children}
    </StyledButton>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  color: PropTypes.string,
  icon: PropTypes.string,
  round: PropTypes.bool,
  type: PropTypes.string,
};

Button.defaultProps = {
  color: 'blue',
  icon: '',
  type: '',
  round: false,
};

export default Button;
