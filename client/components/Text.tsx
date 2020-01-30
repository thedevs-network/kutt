import { switchProp, ifNotProp, ifProp } from "styled-tools";
import { Box, BoxProps } from "reflexbox/styled-components";
import styled, { css } from "styled-components";

import { FC, CSSProperties } from "react";
import { Colors } from "../consts";

interface Props extends Omit<BoxProps, "as"> {
  as?: string;
  htmlFor?: string;
  light?: boolean;
  normal?: boolean;
  bold?: boolean;
  style?: CSSProperties;
}
const Text: FC<Props> = styled(Box)<Props>`
  font-weight: 400;
  ${ifNotProp(
    "fontSize",
    css`
      font-size: ${switchProp("a", {
        p: "1rem",
        h1: "1.802em",
        h2: "1.602em",
        h3: "1.424em",
        h4: "1.266em",
        h5: "1.125em"
      })};
    `
  )}

  ${ifProp(
    "light",
    css`
      font-weight: 300;
    `
  )}

  ${ifProp(
    "normal",
    css`
      font-weight: 400;
    `
  )}

  ${ifProp(
    "bold",
    css`
      font-weight: 700;
    `
  )}
`;

Text.defaultProps = {
  color: Colors.Text
};

export default Text;

export const H1: FC<Props> = props => <Text as="h1" {...props} />;
export const H2: FC<Props> = props => <Text as="h2" {...props} />;
export const H3: FC<Props> = props => <Text as="h3" {...props} />;
export const H4: FC<Props> = props => <Text as="h4" {...props} />;
export const H5: FC<Props> = props => <Text as="h5" {...props} />;
export const H6: FC<Props> = props => <Text as="h6" {...props} />;
export const Span: FC<Props> = props => <Text as="span" {...props} />;
