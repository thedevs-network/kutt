import React from 'react';
import styled from 'styled-components';
import { Flex } from 'reflexbox/styled-components';

import FeaturesItem from './FeaturesItem';

const Section = styled(Flex).attrs({
  width: 1,
  flex: '0 0 auto',
  flexDirection: 'column',
  alignItems: 'center',
  m: 0,
  p: ['64px 0 16px', '64px 0 16px', '64px 0 16px', '102px 0 110px'],
  flexWrap: ['wrap', 'wrap', 'wrap', 'nowrap'],
})`
  position: relative;
  background-color: #eaeaea;
`;

const Title = styled.h3`
  font-size: 28px;
  font-weight: 300;
  margin: 0 0 72px;

  @media only screen and (max-width: 768px) {
    font-size: 24px;
    margin-bottom: 56px;
  }

  @media only screen and (max-width: 448px) {
    font-size: 20px;
    margin-bottom: 40px;
  }
`;

const Features = () => (
  <Section>
    <Title>Kutting edge features.</Title>
    <Flex
      width={1200}
      maxWidth="100%"
      flex="1 1 auto"
      justifyContent="center"
      flexWrap={['wrap', 'wrap', 'wrap', 'nowrap']}
    >
      <FeaturesItem title="Managing links" icon="edit">
        Create, protect and delete your links and monitor them with detailed
        statistics.
      </FeaturesItem>
      <FeaturesItem title="Custom domain" icon="navigation">
        Use custom domains for your links. Add or remove them for free.
      </FeaturesItem>
      <FeaturesItem title="API" icon="zap">
        Use the provided API to create, delete and get URLs from anywhere.
      </FeaturesItem>
      <FeaturesItem title="Free &amp; open source" icon="heart">
        Completely open source and free. You can host it on your own server.
      </FeaturesItem>
    </Flex>
  </Section>
);

export default Features;
