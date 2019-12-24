import { Flex } from "reflexbox/styled-components";
import styled from "styled-components";

const Divider = styled(Flex).attrs({ as: "hr" })`
  width: 100%;
  height: 1px;
  outline: none;
  border: none;
  background-color: #e3e3e3;
`;

export default Divider;
