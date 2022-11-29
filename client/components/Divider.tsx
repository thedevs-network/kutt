import { Flex } from "rebass/styled-components";
import styled from "styled-components";

import { Colors } from "../consts";

const Divider = styled(Flex).attrs({ as: "hr" })`
  width: 100%;
  height: 2px;
  outline: none;
  border: none;
  background-color: ${Colors.Divider};
`;

export default Divider;
