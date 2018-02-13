import React from 'react';
import PropTypes from 'prop-types';
import styled, { css } from 'styled-components';

const Wrapper = styled.div`
  display: flex;
  flex: 1 1 auto;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  background-color: #f1f1f1;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;

  @media only screen and (max-width: 768px) {
    padding: 16px;
  }
`;

const TotalText = styled.p`
  margin: 0;
  padding: 0;

  span {
    font-weight: bold;
    border-bottom: 1px dotted #999;
  }

  @media only screen and (max-width: 768px) {
    font-size: 13px;
  }
`;

const TimeWrapper = styled.div`
  display: flex;
`;

const Button = styled.button`
  display: flex;
  padding: 6px 12px;
  margin: 0 4px;
  border: none;
  font-size: 12px;
  border-radius: 4px;
  box-shadow: 0 0px 10px rgba(100, 100, 100, 0.1);
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease-out;
  box-sizing: border-box;

  :last-child {
    margin-right: 0;
  }

  ${({ active }) =>
    !active &&
    css`
      border: 1px solid #ddd;
      background-color: #f5f5f5;
      box-shadow: 0 2px 6px rgba(150, 150, 150, 0.2);

      :hover {
        border-color: 1px solid #ccc;
        background-color: white;
      }
    `};

  @media only screen and (max-width: 768px) {
    padding: 4px 8px;
    margin: 0 2px;
    font-size: 11px;
  }
`;

const StatsHead = ({ changePeriod, period, total }) => {
  const buttonWithPeriod = (periodText, text) => (
    <Button active={period === periodText} data-period={periodText} onClick={changePeriod}>
      {text}
    </Button>
  );
  return (
    <Wrapper>
      <TotalText>
        Total clicks: <span>{total}</span>
      </TotalText>
      <TimeWrapper>
        {buttonWithPeriod('allTime', 'All Time')}
        {buttonWithPeriod('lastMonth', 'Month')}
        {buttonWithPeriod('lastWeek', 'Week')}
        {buttonWithPeriod('lastDay', 'Day')}
      </TimeWrapper>
    </Wrapper>
  );
};

StatsHead.propTypes = {
  changePeriod: PropTypes.func.isRequired,
  period: PropTypes.string.isRequired,
  total: PropTypes.number.isRequired,
};

export default StatsHead;
