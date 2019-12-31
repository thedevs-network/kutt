import styled, { css } from "styled-components";
import { Box } from "reflexbox/styled-components";
import { switchProp, ifNotProp } from "styled-tools";

interface Props {
  weight?: 300 | 400 | 700;
  htmlFor?: string;
}
const Text = styled(Box)<Props>`
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
`;

Text.defaultProps = {
  as: "p",
  fontWeight: 400,
  color: "hsl(200, 35%, 25%)"
};

export default Text;
