import { Flex } from "reflexbox/styled-components";
import styled, { css } from "styled-components";
import { prop, ifProp } from "styled-tools";
import React, { FC } from "react";

import ChevronRight from "./ChevronRight";
import ChevronLeft from "./ChevronLeft";
import { Colors } from "../../consts";
import Clipboard from "./Clipboard";
import PieChart from "./PieChart";
import Refresh from "./Refresh";
import Spinner from "./Spinner";
import QRCode from "./QRCode";
import Trash from "./Trash";
import Check from "./Check";
import Plus from "./Plus";
import Lock from "./Lock";
import Copy from "./Copy";
import Send from "./Send";
import Key from "./Key";
import Zap from "./Zap";

export interface IIcons {
  clipboard: JSX.Element;
  chevronRight: JSX.Element;
  chevronLeft: JSX.Element;
  pieChart: JSX.Element;
  key: JSX.Element;
  plus: JSX.Element;
  Lock: JSX.Element;
  copy: JSX.Element;
  refresh: JSX.Element;
  check: JSX.Element;
  send: JSX.Element;
  spinner: JSX.Element;
  trash: JSX.Element;
  zap: JSX.Element;
  qrcode: JSX.Element;
}

const icons = {
  clipboard: Clipboard,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  pieChart: PieChart,
  key: Key,
  lock: Lock,
  check: Check,
  plus: Plus,
  copy: Copy,
  refresh: Refresh,
  send: Send,
  spinner: Spinner,
  trash: Trash,
  zap: Zap,
  qrcode: QRCode
};

interface Props extends React.ComponentProps<typeof Flex> {
  name: keyof typeof icons;
  stroke?: string;
  fill?: string;
  hoverFill?: string;
  hoverStroke?: string;
  strokeWidth?: string;
}

const CustomIcon: FC<React.ComponentProps<typeof Flex>> = styled(Flex)`
  position: relative;

  svg {
    transition: all 0.2s ease-out;
    width: 100%;
    height: 100%;

    ${ifProp(
      "fill",
      css`
        fill: ${prop("fill")};
      `
    )}

    ${ifProp(
      "stroke",
      css`
        stroke: ${prop("stroke")};
      `
    )}

    ${ifProp(
      "strokeWidth",
      css`
        stroke-width: ${prop("strokeWidth")};
      `
    )}
  }

  ${ifProp(
    "hoverFill",
    css`
      :hover {
        svg {
          fill: ${prop("hoverFill")};
        }
      }
    `
  )}

  ${ifProp(
    "hoverStroke",
    css`
      :hover {
        svg {
          stroke: ${prop("stroke")};
        }
      }
    `
  )}

  ${ifProp(
    { as: "button" },
    css`
      border: none;
      outline: none;
      transition: transform 0.4s ease-out;
      border-radius: 100%;
      background-color: none !important;
      cursor: pointer;
      box-sizing: border-box;
      box-shadow: 0 2px 1px ${Colors.IconShadow};

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
  justifyContent: "center"
};

export default Icon;
