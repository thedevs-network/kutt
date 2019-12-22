import React from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";
import { NextPage } from "next";

import BodyWrapper from "../components/BodyWrapper";
import Footer from "../components/Footer";
import Text from "../components/Text";

interface Props {
  linkTarget?: string;
}

const UrlInfoPage: NextPage<Props> = ({ linkTarget }) => {
  return (
    <BodyWrapper>
      {!linkTarget ? (
        <Text as="h2" my={4} fontWeight={300}>
          404 | Link could not be found.
        </Text>
      ) : (
        <>
          <Flex flex="1 1 100%" flexDirection="column" alignItems="center">
            <Text as="h2" my={3} fontWeight={300}>
              Target:
            </Text>
            <Text as="h4" fontWeight={700}>
              {linkTarget}
            </Text>
          </Flex>
          <Footer />
        </>
      )}
    </BodyWrapper>
  );
};

UrlInfoPage.getInitialProps = async ctx => {
  return { linkTarget: (ctx?.req as any)?.linkTarget };
};

export default UrlInfoPage;
