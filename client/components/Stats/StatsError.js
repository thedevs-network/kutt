import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const ErrorWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ErrorMessage = styled.h3`
  font-size: 24px;
  font-weight: 300;

  @media only screen and (max-width: 768px) {
    font-size: 18px;
  }
`;

const Icon = styled.img`
  width: 24px;
  height: 24px;
  margin: 6px 12px 0 0;

  @media only screen and (max-width: 768px) {
    width: 18px;
    height: 18px;
  }
`;

const StatsError = ({ text }) => (
  <ErrorWrapper>
    <Icon src="/images/x.svg" />
    <ErrorMessage>{text || 'Could not get the short URL stats.'}</ErrorMessage>
  </ErrorWrapper>
);

StatsError.propTypes = {
  text: PropTypes.string,
};

StatsError.defaultProps = {
  text: '',
};

export default StatsError;
