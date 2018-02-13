import React from 'react';
import PropTypes from 'prop-types';
import styled, { css } from 'styled-components';
import { fadeIn } from '../../helpers/animations';

const LinkInput = styled.input`
  position: relative;
  width: auto;
  flex: 1 1 auto;
  height: 72px;
  padding: 0 84px 0 40px;
  font-size: 20px;
  letter-spacing: 0.05em;
  color: #444;
  box-sizing: border-box;
  background-color: white;
  box-shadow: 0 10px 35px rgba(50, 50, 50, 0.1);
  border-radius: 100px;
  border: none;
  border-bottom: 6px solid #f5f5f5;
  animation: ${fadeIn} 0.5s ease-out;
  transition: all 0.5s ease-out;

  :focus {
    outline: none;
    box-shadow: 0 20px 35px rgba(50, 50, 50, 0.2);
  }

  ::placeholder {
    font-size: 16px;
    letter-spacing: 0.1em;
    color: #888;
  }

  @media only screen and (max-width: 488px) {
    height: 56px;
    padding: 0 48px 0 32px;
    font-size: 14px;
    border-bottom-width: 5px;
    ::placeholder {
      font-size: 14px;
    }
  }

  ${({ small }) =>
    small &&
    css`
      width: 240px;
      height: 54px;
      margin-right: 32px;
      padding: 0 24px 2px;
      font-size: 18px;
      border-bottom: 4px solid #f5f5f5;
      ::placeholder {
        font-size: 13px;
      }

      @media only screen and (max-width: 448px) {
        width: 200px;
        height: 40px;
        padding: 0 16px 2px;
        font-size: 13px;
        border-bottom-width: 3px;
      }
    `};

  ${({ tiny }) =>
    tiny &&
    css`
      flex: 0 0 auto;
      width: 280px;
      height: 32px;
      margin: 0;
      padding: 0 16px 1px;
      font-size: 13px;
      border-bottom-width: 1px;
      border-radius: 4px;
      box-shadow: 0 4px 10px rgba(100, 100, 100, 0.1);

      :focus {
        box-shadow: 0 10px 25px rgba(50, 50, 50, 0.1);
      }

      ::placeholder {
        font-size: 12px;
        letter-spacing: 0;
      }

      @media only screen and (max-width: 768px) {
        width: 240px;
        height: 28px;
      }

      @media only screen and (max-width: 510px) {
        width: 180px;
        height: 24px;
        padding: 0 8px 1px;
        font-size: 12px;
        border-bottom-width: 3px;
      }
    `};

  ${({ height }) =>
    height &&
    css`
      height: ${height}px;
    `};
`;

const TextInput = props => <LinkInput {...props} />;

TextInput.propTypes = {
  small: PropTypes.bool,
  tiny: PropTypes.bool,
};

TextInput.defaultProps = {
  small: false,
  tiny: false,
};

export default TextInput;
