import { Flex } from "rebass/styled-components";
import styled, { css } from "styled-components";
import { prop, ifProp } from "styled-tools";
import React, { FC } from "react";

import ChevronRight from "./ChevronRight";
import ChevronLeft from "./ChevronLeft";
import { Colors } from "../../consts";
import Clipboard from "./Clipboard";
import ArrowLeft from "./ArrowLeft";
import PieChart from "./PieChart";
import Refresh from "./Refresh";
import Spinner from "./Spinner";
import Shuffle from "./Shuffle";
import EditAlt from "./EditAlt";
import QRCode from "./QRCode";
import Signup from "./Signup";
import Trash from "./Trash";
import Check from "./Check";
import Login from "./Login";
import Heart from "./Heart";
import Stop from "./Stop";
import Plus from "./Plus";
import Lock from "./Lock";
import Edit from "./Edit";
import Copy from "./Copy";
import Send from "./Send";
import Key from "./Key";
import Zap from "./Zap";
import X from "./X";

const icons = {
  arrowLeft: ArrowLeft,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clipboard: Clipboard,
  copy: Copy,
  edit: Edit,
  editAlt: EditAlt,
  heart: Heart,
  key: Key,
  lock: Lock,
  login: Login,
  pieChart: PieChart,
  plus: Plus,
  qrcode: QRCode,
  refresh: Refresh,
  send: Send,
  shuffle: Shuffle,
  signup: Signup,
  spinner: Spinner,
  stop: Stop,
  trash: Trash,
  x: X,
  zap: Zap
};

export type Icons = keyof typeof icons;

interface Props extends React.ComponentProps<typeof Flex> {
  name: Icons;
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
