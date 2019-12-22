import styled, { css } from "styled-components";
import { ifProp, withProp } from "styled-tools";
import { Flex } from "reflexbox/styled-components";

import { fadeIn } from "../helpers/animations";

interface Props {
  autoFocus?: boolean;
  name?: string;
  id?: string;
  type?: string;
  value?: string;
  required?: boolean;
  small?: boolean;
  onChange?: any;
  tiny?: boolean;
  placeholderSize?: number[];
}

const TextInput = styled(Flex).attrs({
  as: "input"
})<Props>`
  position: relative;
  box-sizing: border-box;
  letter-spacing: 0.05em;
  color: #444;
  background-color: white;
  box-shadow: 0 10px 35px rgba(50, 50, 50, 0.1);
  border-radius: 100px;
  border: none;
  border-bottom: 5px solid #f5f5f5;
  animation: ${fadeIn} 0.5s ease-out;
  transition: all 0.5s ease-out;

  :focus {
    outline: none;
    box-shadow: 0 20px 35px rgba(50, 50, 50, 0.2);
  }

  ::placeholder {
    font-size: ${withProp("placeholderSize", s => s[0] || 14)};
    letter-spacing: 0.05em;
    color: #888;
  }

  @media screen and (min-width: 64em) {
    ::placeholder {
      font-size: ${withProp("placeholderSize", s => s[3] || 16)}px;
    }
  }

  @media screen and (min-width: 52em) {
    letter-spacing: 0.1em;
    border-bottom-width: 6px;
    ::placeholder {
      font-size: ${withProp("placeholderSize", s => s[2] || 15)}px;
    }
  }

  @media screen and (min-width: 40em) {
    ::placeholder {
      font-size: ${withProp("placeholderSize", s => s[1] || 15)}px;
    }
  }

  /* ${ifProp(
    "small",
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
    `
  )}

  ${ifProp(
    "tiny",
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
    `
  )} */
`;

TextInput.defaultProps = {
  value: "",
  small: false,
  tiny: false,
  height: [56, 72],
  py: 0,
  pr: [48, 84],
  pl: [32, 40],
  fontSize: [14, 16],
  placeholderSize: []
};

export default TextInput;
