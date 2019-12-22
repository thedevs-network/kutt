import styled from "styled-components";
import { Box, BoxProps } from "reflexbox/styled-components";

interface Props extends BoxProps {
  href?: string;
  title?: string;
  target?: string;
}
const ALink = styled(Box).attrs({
  as: "a"
})<Props>`
  cursor: pointer;
  color: #2196f3;
  border-bottom: 1px dotted transparent;
  text-decoration: none;

  :hover {
    border-bottom-color: #2196f3;
  }
`;

ALink.defaultProps = {
  pb: "1px"
};

export default ALink;
