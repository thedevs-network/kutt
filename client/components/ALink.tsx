import { Box, BoxProps } from "reflexbox/styled-components";
import styled, { css } from "styled-components";
import { ifProp } from "styled-tools";

interface Props extends BoxProps {
  href?: string;
  title?: string;
  target?: string;
  rel?: string;
  forButton?: boolean;
}
const ALink = styled(Box).attrs({
  as: "a"
})<Props>`
  cursor: pointer;
  color: #2196f3;
  border-bottom: 1px dotted transparent;
  text-decoration: none;
  transition: all 0.2s ease-out;

  ${ifProp(
    { forButton: false },
    css`
      :hover {
        border-bottom-color: #2196f3;
      }
    `
  )}
`;

ALink.defaultProps = {
  pb: "1px",
  forButton: false
};

export default ALink;
