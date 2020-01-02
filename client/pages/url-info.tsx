import React from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";
import { NextPage } from "next";

import AppWrapper from "../components/AppWrapper";
import Footer from "../components/Footer";
import { H2, H4 } from "../components/Text";
import { Col } from "../components/Layout";

interface Props {
  linkTarget?: string;
}

const UrlInfoPage: NextPage<Props> = ({ linkTarget }) => {
  return (
    <AppWrapper>
      {!linkTarget ? (
        <H2 my={4} light>
          404 | Link could not be found.
        </H2>
      ) : (
        <>
          <Col flex="1 1 100%" alignItems="center">
            <H2 my={3} light>
              Target:
            </H2>
            <H4 bold>{linkTarget}</H4>
          </Col>
          <Footer />
        </>
      )}
    </AppWrapper>
  );
};

UrlInfoPage.getInitialProps = async ctx => {
  return { linkTarget: (ctx?.req as any)?.linkTarget };
};

export default UrlInfoPage;
