import React, { FC } from "react";
import styled, { css } from "styled-components";
import { switchProp, prop, ifProp } from "styled-tools";
import { Flex, BoxProps } from "reflexbox/styled-components";

// TODO: another solution for inline SVG
import SVG from "react-inlinesvg";

import { spin } from "../helpers/animations";

interface Props extends BoxProps {
  color?: "purple" | "gray" | "blue" | "red";
  disabled?: boolean;
  icon?: string; // TODO: better typing
  isRound?: boolean;
  onClick?: any; // TODO: better typing
  type?: "button" | "submit" | "reset";
}

const StyledButton = styled(Flex)<Props>`
  position: relative;
  align-items: center;
  justify-content: center;
  font-weight: normal;
  text-align: center;
  line-height: 1;
  word-break: keep-all;
  color: ${switchProp(prop("color", "blue"), {
    blue: "white",
    red: "white",
    purple: "white",
    gray: "#444"
  })};
  background: ${switchProp(prop("color", "blue"), {
    blue: "linear-gradient(to right, #42a5f5, #2979ff)",
    red: "linear-gradient(to right, #ee3b3b, #e11c1c)",
    purple: "linear-gradient(to right, #7e57c2, #6200ea)",
    gray: "linear-gradient(to right, #e0e0e0, #bdbdbd)"
  })};
  box-shadow: ${switchProp(prop("color", "blue"), {
    blue: "0 5px 6px rgba(66, 165, 245, 0.5)",
    red: "0 5px 6px rgba(168, 45, 45, 0.5)",
    purple: "0 5px 6px rgba(81, 45, 168, 0.5)",
    gray: "0 5px 6px rgba(160, 160, 160, 0.5)"
  })};
  border: none;
  border-radius: 100px;
  transition: all 0.4s ease-out;
  cursor: pointer;
  overflow: hidden;

  :hover,
  :focus {
    outline: none;
    box-shadow: ${switchProp(prop("color", "blue"), {
      blue: "0 6px 15px rgba(66, 165, 245, 0.5)",
      red: "0 6px 15px rgba(168, 45, 45, 0.5)",
      purple: "0 6px 15px rgba(81, 45, 168, 0.5)",
      gray: "0 6px 15px rgba(160, 160, 160, 0.5)"
    })};
    transform: translateY(-2px) scale(1.02, 1.02);
  }
`;

const Icon = styled(SVG)`
  svg {
    width: 16px;
    height: 16px;
    margin-right: 12px;
    stroke: ${ifProp({ color: "gray" }, "#444", "#fff")};

    ${ifProp(
      { icon: "loader" },
      css`
        width: 20px;
        height: 20px;
        margin: 0;
        animation: ${spin} 1s linear infinite;
      `
    )}

    ${ifProp(
      "isRound",
      css`
        width: 15px;
        height: 15px;
        margin: 0;
      `
    )}

    @media only screen and (max-width: 768px) {
      width: 12px;
      height: 12px;
      margin-right: 6px;
    }
  }
`;

export const Button: FC<Props> = props => {
  const SVGIcon = props.icon ? (
    <Icon
      icon={props.icon}
      isRound={props.isRound}
      color={props.color}
      src={`/images/${props.icon}.svg`}
    />
  ) : (
    ""
  );
  return (
    <StyledButton {...props}>
      {SVGIcon}
      {props.icon !== "loader" && props.children}
    </StyledButton>
  );
};

Button.defaultProps = {
  as: "button",
  width: "auto",
  flex: "0 0 auto",
  height: [32, 40],
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
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease-out;
  box-sizing: border-box;

  :hover {
    transform: translateY(-2px);
  }

  ${ifProp(
    "disabled",
    css`
      background-color: #f6f6f6;
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
