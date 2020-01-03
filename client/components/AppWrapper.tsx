import { Flex } from "reflexbox/styled-components";
import styled from "styled-components";
import React from "react";

import { useStoreState } from "../store";
import PageLoading from "./PageLoading";
import Header from "./Header";

const Wrapper = styled(Flex)`
  input {
    filter: none;
  }

  * {
    box-sizing: border-box;
  }

  *::-moz-focus-inner {
    border: none;
  }
`;

const AppWrapper = ({ children }: { children: any }) => {
  const loading = useStoreState(s => s.loading.loading);

  return (
    <Wrapper
      minHeight="100vh"
      width={1}
      flex="0 0 auto"
      alignItems="center"
      flexDirection="column"
    >
      <Header />
      {loading ? <PageLoading /> : children}
    </Wrapper>
  );
};

export default AppWrapper;
