import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import Area from './Area';
import Pie from './Pie';
import Bar from './Bar';

const ChartsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 32px;

  @media only screen and (max-width: 768px) {
    padding: 16px 16px 32px 16px;
  }
`;

const Row = styled.div`
  display: flex;
  border-bottom: 1px dotted #aaa;
  padding: 0 0 40px 0;
  margin: 0 0 32px 0;

  :last-child {
    border: none;
    margin: 0;
  }

  @media only screen and (max-width: 768px) {
    flex-direction: column;
    padding-bottom: 0;
    margin-bottom: 0;
    border-bottom: none;

    > *:not(:last-child) {
      padding-bottom: 24px;
      margin-bottom: 16px;
      border-bottom: 1px dotted #aaa;
    }
  }
`;

const StatsCharts = ({ stats, period, updatedAt }) => {
  const periodText = period.includes('last')
    ? `the last ${period.replace('last', '').toLocaleLowerCase()}`
    : 'all time';
  const hasView = stats.views.some(view => view > 0);
  return (
    <ChartsWrapper>
      <Row>
        <Area data={stats.views} period={period} updatedAt={updatedAt} periodText={periodText} />
      </Row>
      {hasView
        ? [
            <Row key="second-row">
              <Pie data={stats.stats.referrer} updatedAt={updatedAt} title="Referrals" />
              <Bar data={stats.stats.browser} updatedAt={updatedAt} title="Browsers" />
            </Row>,
            <Row key="third-row">
              <Pie data={stats.stats.country} updatedAt={updatedAt} title="Country" />
              <Bar
                data={stats.stats.os.map(o => ({
                  ...o,
                  name: o.name === 'Mac Os X' ? 'macOS' : o.name,
                }))}
                updatedAt={updatedAt}
                title="OS"
              />
            </Row>,
          ]
        : null}
    </ChartsWrapper>
  );
};

StatsCharts.propTypes = {
  updatedAt: PropTypes.string.isRequired,
  period: PropTypes.string.isRequired,
  stats: PropTypes.shape({
    stats: PropTypes.object.isRequired,
    views: PropTypes.array.isRequired,
  }).isRequired,
};

export default StatsCharts;
