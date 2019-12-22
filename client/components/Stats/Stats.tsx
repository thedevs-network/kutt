import React, { Component, FC, useState, useEffect } from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import Router from "next/router";
import styled from "styled-components";
import axios from "axios";
import cookie from "js-cookie";
import { Box, Flex } from "reflexbox/styled-components";

import StatsError from "./StatsError";
import StatsHead from "./StatsHead";
import StatsCharts from "./StatsCharts";
import PageLoading from "../PageLoading";
import Button from "../Button";

interface Props {
  isAuthenticated: boolean;
  domain: string;
  id: string;
}

const Title = styled.h2`
  font-size: 24px;
  font-weight: 300;

  a {
    color: #2196f3;
    text-decoration: none;
    border-bottom: 1px dotted transparent;

    :hover {
      border-bottom-color: #2196f3;
    }
  }

  @media only screen and (max-width: 768px) {
    font-size: 18px;
  }
`;

const TitleTarget = styled.p`
  font-size: 14px;
  text-align: right;
  color: #333;

  @media only screen and (max-width: 768px) {
    font-size: 11px;
  }
`;

const Content = styled(Flex).attrs({
  flex: "1 1 auto",
  flexDirection: "column"
})`
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 6px 30px rgba(50, 50, 50, 0.2);
`;

const Stats: FC<Props> = ({ domain, id, isAuthenticated }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stats, setStats] = useState();
  const [period, setPeriod] = useState();

  useEffect(() => {
    if (id) return null;
    axios
      .get(`/api/url/stats?id=${id}&domain=${domain}`, {
        headers: { Authorization: cookie.get("token") }
      })
      .then(({ data }) => {
        setLoading(false);
        setError(!data);
        setStats(data);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  }, []);

  const changePeriod = e => setPeriod(e.currentTarget.dataset.period);

  function goToHomepage(e) {
    e.preventDefault();
    Router.push("/");
  }

  if (!isAuthenticated)
    return <StatsError text="You need to login to view stats." />;

  if (!id || error) return <StatsError />;

  if (loading) return <PageLoading />;

  return (
    <Flex
      width={1200}
      maxWidth="95%"
      flexDirection="column"
      alignItems="stretch"
      m="40px 0"
    >
      <Flex justifyContent="space-between" alignItems="center">
        <Title>
          Stats for:{" "}
          <a href={stats.shortLink} title="Short link">
            {stats.shortLink.replace(/https?:\/\//, "")}
          </a>
        </Title>
        <TitleTarget>
          {stats.target.length > 80
            ? `${stats.target
                .split("")
                .slice(0, 80)
                .join("")}...`
            : stats.target}
        </TitleTarget>
      </Flex>
      <Content>
        <StatsHead
          total={stats.total}
          period={period}
          changePeriod={changePeriod}
        />
        <StatsCharts
          stats={stats[period]}
          updatedAt={stats.updatedAt}
          period={period}
        />
      </Content>
      <Box alignSelf="center" my={64}>
        <Button icon="arrow-left" onClick={goToHomepage}>
          Back to homepage
        </Button>
      </Box>
    </Flex>
  );
};

const mapStateToProps = ({ auth: { isAuthenticated } }) => ({
  isAuthenticated
});

export default connect(
  mapStateToProps,
  null
)(Stats);
