import React from 'react';
import styled from 'styled-components';
import FeaturesItem from './FeaturesItem';

const Section = styled.div`
  position: relative;
  width: 100%;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0;
  padding: 102px 0;
  background-color: #eaeaea;

  @media only screen and (max-width: 768px) {
    margin: 0;
    padding: 64px 0 16px;
    flex-wrap: wrap;
  }
`;

const Wrapper = styled.div`
  width: 1200px;
  max-width: 100%;
  flex: 1 1 auto;
  display: flex;
  justify-content: center;

  @media only screen and (max-width: 1200px) {
    flex-wrap: wrap;
  }
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
    <Wrapper>
      <FeaturesItem title="Managing links" icon="edit">
        Create, protect and delete your links and monitor them with detailed statistics.
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
    </Wrapper>
  </Section>
);

export default Features;
