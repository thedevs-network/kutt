import React from "react";
import { NextPage } from "next";

import BodyWrapper from "../components/BodyWrapper";
import Stats from "../components/Stats";

interface Props {
  domain?: string;
  id?: string;
}

const StatsPage: NextPage<Props> = ({ domain, id }) => (
  <BodyWrapper>
    <Stats domain={domain} id={id} />
  </BodyWrapper>
);

StatsPage.getInitialProps = ({ query }) => {
  return Promise.resolve(query);
};

StatsPage.defaultProps = {
  domain: "",
  id: ""
};

export default StatsPage;
