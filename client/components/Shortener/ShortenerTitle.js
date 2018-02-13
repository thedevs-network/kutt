import React from 'react';
import styled from 'styled-components';

const Title = styled.h1`
  font-size: 32px;
  font-weight: 300;
  margin: 8px 0 0;
  color: #333;

  @media only screen and (max-width: 448px) {
    font-size: 22px;
  }
`;

const Underline = styled.span`
  border-bottom: 2px dotted #999;
`;

const ShortenerTitle = () => (
  <Title>
    Kutt your links <Underline>shorter</Underline>.
  </Title>
);

export default ShortenerTitle;
