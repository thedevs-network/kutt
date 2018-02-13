import React from 'react';
import styled from 'styled-components';
import { spin } from '../../helpers/animations';

const Loading = styled.div`
  margin: 0 0 48px;
  flex: 1 1 auto;
  flex-basis: 250px;
  display: flex;
  align-self: center;
  align-items: center;
  justify-content: center;
`;

const Icon = styled.img`
  display: block;
  width: 28px;
  height: 28px;
  animation: ${spin} 1s linear infinite;
`;

const pageLoading = () => (
  <Loading>
    <Icon src="/images/loader.svg" />
  </Loading>
);

export default pageLoading;
