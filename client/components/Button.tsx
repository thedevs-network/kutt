import styled, { css } from "styled-components";
import {  ifProp, prop } from "styled-tools";

import { Flex, BoxProps } from "reflexbox/styled-components";

import { darken, lighten, transparentize } from 'polished';
import { theme, Colors } from "../consts/theme";

const propAndCall = (key, callback) => (props) => {
  const prop = props[key]
  if (!props) return ''
  return callback(prop)
} 

interface Props extends BoxProps {
  theme: typeof theme,
  disabled?: boolean;
  icon?: string; // TODO: better typing
  isRound?: boolean;
  onClick?: any; // TODO: better typing
  type?: "button" | "submit" | "reset";
}
function getBackground(props: Props): string {
  const { theme: { background }, color } = props
  if (!background[color]) return ''
  const start = lighten(0.1, background[color])
  const end = darken(.08, background[color])
  return `linear-gradient(to right, ${start},  ${end})`
}

const getBoxShadow = (isFocused = false) => (props: Props) => {
  const { theme: { background }, color } = props
  if (!background[color]) return ''
  const transColor = transparentize(0.5, background[color])
  if(isFocused){
    return `0 6px 15px ${transColor}`
  }
    return `0 5px 6px ${transColor}`
}

export const Button = styled(Flex)<Props>`
  position: relative;
  align-items: center;
  justify-content: center;
  font-weight: normal;
  text-align: center;
  line-height: 1;
  word-break: keep-all;
  color: ${props => props.theme.text[props.color]};
   background:${getBackground};
  box-shadow: ${getBoxShadow(false)};

  border: none;
  border-radius: 100px;
  transition: all 0.4s ease-out;
  cursor: pointer;
  overflow: hidden;

  :hover,
  :focus {
    outline: none;
    box-shadow: ${getBoxShadow(true)};
    transform:  translateY(-2px) scale(1.02, 1.02);

  }
`;

Button.defaultProps = {
  as: "button",
  width: "auto",
  flex: "0 0 auto",
  height: [36, 40],
  py: 0,
  px: [24, 32],
  fontSize: [12, 13],
  color: "blue",
  icon: "",
  isRound: false
};

interface NavButtonProps extends BoxProps {
  disabled?: boolean;
  onClick?: any; // TODO: better typing
  type?: "button" | "submit" | "reset";
  key?: string;
}

export const NavButton = styled(Flex)<NavButtonProps>`
  display: flex;
  border: none;
  border-radius: 4px;
  box-shadow: 0 0px 10px rgba(100, 100, 100, 0.1);
  background-color: ${prop("theme.background.accent")};
  cursor: pointer;
  transition: all 0.2s ease-out;
  box-sizing: border-box;

  :hover {
    transform: translateY(-2px);
  }

  ${ifProp(
    "disabled",
    css`
      background-color: ${prop("theme.background.disabled")};
      box-shadow: 0 0px 5px rgba(150, 150, 150, 0.1);
      cursor: default;

      :hover {
        transform: none;
      }
    `
  )}
`;

NavButton.defaultProps = {
  as: "button",
  type: "button",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  width: "auto",
  height: [26, 28],
  py: 0,
  px: ["6px", "8px"],
  fontSize: [12]
};
