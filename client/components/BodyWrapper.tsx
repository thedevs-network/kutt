import React, { FC, useEffect } from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import styled from "styled-components";
import cookie from "js-cookie";
import { Flex } from "reflexbox/styled-components";

import Header from "./Header";
import PageLoading from "./PageLoading";
import { renewAuthUser } from "../actions";
import { initGA, logPageView } from "../helpers/analytics";
import { useStoreState } from "../store";

interface Props {
  norenew?: boolean;
  pageLoading: boolean;
  renewAuthUser: any; // TODO: better typing;
}

const Wrapper = styled.div`
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }

  *::-moz-focus-inner {
    border: none;
  }

  @media only screen and (max-width: 448px) {
    font-size: 14px;
  }
`;

const BodyWrapper: FC<Props> = ({ children, norenew, renewAuthUser }) => {
  const loading = useStoreState(s => s.loading.loading);

  useEffect(() => {
    // FIXME: types bro
    if (process.env.GOOGLE_ANALYTICS) {
      if (!(window as any).GA_INITIALIZED) {
        initGA();
        (window as any).GA_INITIALIZED = true;
      }
      logPageView();
    }

    const token = cookie.get("token");
    if (!token || norenew) return undefined;
    renewAuthUser(token);
  }, []);

  const content = loading ? <PageLoading /> : children;
  return (
    <Wrapper>
      <Flex
        minHeight="100vh"
        width={1}
        flex="0 0 auto"
        alignItems="center"
        flexDirection="column"
      >
        <Header />
        {content}
      </Flex>
    </Wrapper>
  );
};

BodyWrapper.defaultProps = {
  norenew: false
};

const mapDispatchToProps = dispatch => ({
  renewAuthUser: bindActionCreators(renewAuthUser, dispatch)
});

export default connect(
  null,
  mapDispatchToProps
)(BodyWrapper);
