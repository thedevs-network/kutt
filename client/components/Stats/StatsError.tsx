import React, { FC } from 'react';
import styled from 'styled-components';
import { Flex } from 'reflexbox/styled-components';

interface Props {
  text?: string;
}

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

const StatsError: FC<Props> = ({ text }) => (
  <Flex justifyContent="center" alignItems="center">
    <Icon src="/images/x.svg" />
    <ErrorMessage>{text || 'Could not get the short URL stats.'}</ErrorMessage>
  </Flex>
);

StatsError.defaultProps = {
  text: '',
};

export default StatsError;
