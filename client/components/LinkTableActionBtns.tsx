import React from "react";
import Icon from "./Icon";
import styled from "styled-components";
import { Colors } from "../consts";

export const Action = (props: React.ComponentProps<typeof Icon>) => (
  <Icon
    as="button"
    py={0}
    px={0}
    mr={2}
    size={[23, 24]}
    flexShrink={0}
    p={["4px", "5px"]}
    stroke="#666"
    {...props}
  />
);

export const CopyIconAction = styled(Action)`
  background-color: ${Colors.CopyIconBg};
  background-color: var(--color-copy-icon-bg);

  svg {
    stroke: ${Colors.CopyIcon};
    stroke: var(--color-copy-icon);
  }
`;

export const PieIconAction = styled(Action)`
  background-color: ${Colors.PieIconBg};
  background-color: var(--color-pie-icon-bg);

  svg {
    stroke: ${Colors.PieIcon};
    stroke: var(--color-pie-icon);
  }
`;

export const EditIconAction = styled(Action)`
  background-color: ${Colors.EditIconBg};
  background-color: var(--color-edit-icon-bg);

  svg {
    stroke: ${Colors.EditIcon};
    stroke: var(--color-edit-icon);
  }
`;

export const QrCodeIconAction = styled(Action)`
  background-color: ${Colors.QrCodeIconBg};
  background-color: var(--color-qrcode-icon-bg);

  svg {
    stroke: ${Colors.QrCodeIcon};
    stroke: var(--color-qrcode-icon);
  }
`;

export const StopIconAction = styled(Action)`
  background-color: ${Colors.StopIconBg};
  background-color: var(--color-stop-icon-bg);

  svg {
    stroke: ${Colors.StopIcon};
    stroke: var(--color-stop-icon);
  }
`;

export const TrashIconAction = styled(Action)`
  background-color: ${Colors.TrashIconBg};
  background-color: var(--color-trash-icon-bg);

  svg {
    stroke: ${Colors.TrashIcon};
    stroke: var(--color-trash-icon);
  }
`;
