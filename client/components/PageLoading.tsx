import { Flex } from "reflexbox/styled-components";
import React from "react";

import { useTheme } from "../hooks";
import Icon from "./Icon";

const PageLoading = () => {
  const theme = useTheme()   
  return (
    <Flex
      flex="1 1 250px"
      alignItems="center"
      alignSelf="center"
      justifyContent="center"
      margin="0 0 48px"
    >
      <Icon name="spinner" size={24} stroke={theme.component.spinner} />
    </Flex>
  )
};


export default PageLoading;
