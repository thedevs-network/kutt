import { Flex } from "reflexbox/styled-components";
import styled, { css } from "styled-components";
import { prop, ifProp } from "styled-tools";
import React, { FC } from "react";

import Trash from "./Trash";
import Spinner from "./Spinner";
import Plus from "./Plus";
import Lock from "./Lock";
import Refresh from "./Refresh";
import Zap from "./Zap";

export interface IIcons {
  lock: JSX.Element;
  refresh: JSX.Element;
  zap: JSX.Element;
  plus: JSX.Element;
  spinner: JSX.Element;
  trash: JSX.Element;
}

const icons = {
  lock: Lock,
  refresh: Refresh,
  zap: Zap,
  plus: Plus,
  spinner: Spinner,
  trash: Trash,
};

interface Props extends React.ComponentProps<typeof Flex> {
  name: keyof typeof icons;
}

const CustomIcon: FC<React.ComponentProps<typeof Flex>> = styled(Flex)`
  position: relative;
  fill: ${prop("color")};

  svg {
    width: 100%;
    height: 100%;
  }

  ${ifProp(
    { as: "button" },
    css`
      border: none;
      outline: none;
      transition: transform 0.4s ease-out;
      background-color: transparent;
      cursor: pointer;
      box-sizing: content-box;

      :hover,
      :focus {
        transform: translateY(-2px) scale(1.02, 1.02);
      }
      :focus {
        outline: 3px solid rgba(65, 164, 245, 0.5);
      }
    `
  )}
`;

const Icon: FC<Props> = ({ name, ...rest }) => (
  <CustomIcon {...rest}>{React.createElement(icons[name])}</CustomIcon>
);

Icon.defaultProps = {
  size: 16,
  alignItems: "center",
  justifyContent: "center",
  color: "#888"
};

export default Icon;
