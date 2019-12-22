import React from 'react';
import styled from 'styled-components';
import { Flex } from 'reflexbox/styled-components';

import { spin } from '../helpers/animations';

const Icon = styled.img`
  display: block;
  width: 28px;
  height: 28px;
  animation: ${spin} 1s linear infinite;
`;

const pageLoading = () => (
  <Flex
    flex="1 1 250px"
    alignItems="center"
    alignSelf="center"
    justifyContent="center"
    margin="0 0 48px"
  >
    <Icon src="/images/loader.svg" />
  </Flex>
);

export default pageLoading;
