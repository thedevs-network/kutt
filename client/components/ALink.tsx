import styled from "styled-components";
import { Box, BoxProps } from "reflexbox/styled-components";

interface Props extends BoxProps {
  href?: string;
  title?: string;
  target?: string;
  rel?: string;
}
const ALink = styled(Box).attrs({
  as: "a"
})<Props>`
  cursor: pointer;
  color: #2196f3;
  border-bottom: 1px dotted transparent;
  text-decoration: none;
  transition: all 0.2s ease-out;

  :hover {
    border-bottom-color: #2196f3;
  }
`;

ALink.defaultProps = {
  pb: "1px"
};

export default ALink;
