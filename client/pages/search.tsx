import { useRouter } from "next/router";
import React from 'react';
import getConfig from "next/config";

import AppWrapper from "../components/AppWrapper";
import Footer from "../components/Footer";
import SearchBar from "../components/SearchBar";
import { H2 } from "../components/Text";
import { Col  } from "../components/Layout";

const { publicRuntimeConfig } = getConfig();

const search = () => {
  const { query } = useRouter();
  return (
    <AppWrapper>
      <Col flex="1 1 100%" alignItems="center">
        <H2 my={4} light>
          Welcome to {publicRuntimeConfig.SITE_NAME}
        </H2>
        <Col width={800} maxWidth="100%" px={[3]} flex="0 0 auto" mt={4}>
          <SearchBar />
        </Col>
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default search;
