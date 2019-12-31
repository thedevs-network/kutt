import { Flex } from "reflexbox/styled-components";
import React from "react";

import Icon from "./Icon";

const pageLoading = () => (
  <Flex
    flex="1 1 250px"
    alignItems="center"
    alignSelf="center"
    justifyContent="center"
    margin="0 0 48px"
  >
    <Icon name="spinner" size={24} stroke="#888" />
  </Flex>
);

export default pageLoading;
