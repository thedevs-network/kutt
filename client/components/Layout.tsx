import React from "react";
import { Flex } from "rebass/styled-components";
import { FC } from "react";

type Props = React.ComponentProps<typeof Flex>;

export const Col: FC<Props> = (props) => (
  <Flex flexDirection="column" {...props} />
);

export const RowCenterV: FC<Props> = (props) => (
  <Flex alignItems="center" {...props} />
);

export const RowCenterH: FC<Props> = (props) => (
  <Flex justifyContent="center" {...props} />
);

export const RowCenter: FC<Props> = (props) => (
  <Flex alignItems="center" justifyContent="center" {...props} />
);

export const ColCenterV: FC<Props> = (props) => (
  <Flex flexDirection="column" justifyContent="center" {...props} />
);

export const ColCenterH: FC<Props> = (props) => (
  <Flex flexDirection="column" alignItems="center" {...props} />
);

export const ColCenter: FC<Props> = (props) => (
  <Flex
    flexDirection="column"
    alignItems="center"
    justifyContent="center"
    {...props}
  />
);
