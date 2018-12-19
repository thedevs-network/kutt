import React from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import Button from '../Button';
import { fadeIn } from '../../helpers/animations';

const Wrapper = styled.div`
  position: relative;
  width: 1200px;
  max-width: 98%;
  display: flex;
  align-items: center;
  margin: 16px 0 0;
  animation: ${fadeIn} 0.8s ease-out;
  box-sizing: border-box;

  a {
    text-decoration: none;
  }

  @media only screen and (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: -32px;

  @media only screen and (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    margin-bottom: 32px;
  }
`;

const Title = styled.h2`
  font-size: 28px;
  font-weight: 300;
  padding-right: 32px;
  margin-bottom: 48px;

  @media only screen and (max-width: 768px) {
    font-size: 22px;
    text-align: center;
    padding-right: 0;
    margin-bottom: 32px;
    padding: 0 40px;
  }

  @media only screen and (max-width: 448px) {
    font-size: 18px;
    text-align: center;
    margin-bottom: 24px;
  }
`;

const Image = styled.img`
  flex: 0 0 60%;
  width: 60%;
  max-width: 100%;
  height: auto;

  @media only screen and (max-width: 768px) {
    flex-basis: 100%;
    width: 100%;
  }
`;

const NeedToLogin = () => (
  <Wrapper>
    <TitleWrapper>
      <Title>
        Manage links, set custom <b>domains</b> and view <b>stats</b>.
      </Title>
      <Link href="/login" prefetch>
        <a href="/login" title="login / signup">
          <Button>Login / Signup</Button>
        </a>
      </Link>
    </TitleWrapper>
    <Image src="/images/callout.png" />
  </Wrapper>
);

export default NeedToLogin;
