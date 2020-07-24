import { Flex } from "reflexbox/styled-components";
import styled from "styled-components";

import {prop} from "styled-tools";

const Divider = styled(Flex).attrs({ as: "hr" })`
  width: 100%;
  height: 2px;
  outline: none;
  border: none;
  background-color: ${prop("theme.component.divider")};
`;

export default Divider;
