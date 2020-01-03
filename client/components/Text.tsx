import { switchProp, ifNotProp, ifProp } from "styled-tools";
import { Box } from "reflexbox/styled-components";
import styled, { css } from "styled-components";

import { Colors } from "../consts";
import { FC, ComponentProps } from "react";

interface Props {
  htmlFor?: string;
  light?: boolean;
  normal?: boolean;
  bold?: boolean;
}
const Text = styled(Box)<Props>`
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
  as: "p",
  color: Colors.Text
};

export default Text;

type TextProps = ComponentProps<typeof Text>;

export const H1: FC<TextProps> = props => <Text as="h1" {...props} />;
export const H2: FC<TextProps> = props => <Text as="h2" {...props} />;
export const H3: FC<TextProps> = props => <Text as="h3" {...props} />;
export const H4: FC<TextProps> = props => <Text as="h4" {...props} />;
export const H5: FC<TextProps> = props => <Text as="h5" {...props} />;
export const H6: FC<TextProps> = props => <Text as="h6" {...props} />;
export const Span: FC<TextProps> = props => <Text as="span" {...props} />;
