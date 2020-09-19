import { Flex } from "reflexbox/styled-components";
import React, { useEffect } from "react";
import styled from "styled-components";
import Router from "next/router";

import { useStoreState, useStoreActions } from "../store";
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
  const isAuthenticated = useStoreState(s => s.auth.isAuthenticated);
  const logout = useStoreActions(s => s.auth.logout);
  const fetched = useStoreState(s => s.settings.fetched);
  const loading = useStoreState(s => s.loading.loading);
  const getSettings = useStoreActions(s => s.settings.getSettings);

  const isVerifyEmailPage =
    typeof window !== "undefined" &&
    window.location.pathname.includes("verify-email");

  useEffect(() => {
    if (isAuthenticated && !fetched && !isVerifyEmailPage) {
      getSettings().catch(() => logout());
    }
  }, [isVerifyEmailPage]);

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
