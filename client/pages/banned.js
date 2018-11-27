import React, { Component } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import withRedux from 'next-redux-wrapper';
import initialState from '../store';
import BodyWrapper from '../components/BodyWrapper';
import Footer from '../components/Footer';
import { authUser } from '../actions';

const Wrapper = styled.div`
  display: flex;
  flex: 1 1 100%;
  flex-direction: column;
  align-items: cetner;
`;

const Title = styled.h3`
  font-size: 24px;
  font-weight: normal;
  text-align: center;
  margin: 24px 0 0;

  span {
    font-weight: bold;
    border-bottom: 1px dotted rgba(0, 0, 0, 0.4);
  }

  @media only screen and (max-width: 448px) {
    font-size: 18px;
  }
`;

const Subtitle = styled.h3`
  font-size: 16px;
  font-weight: normal;
  text-align: center;

  @media only screen and (max-width: 448px) {
    font-size: 14px;
  }
`;

class BannedPage extends Component {
  static getInitialProps({ req, store }) {
    const token = req && req.cookies && req.cookies.token;
    if (token && store) store.dispatch(authUser(token));
    return {};
  }

  render() {
    return (
      <BodyWrapper>
        <Wrapper>
          <Title>
            Link has been banned and removed because of <span>malware or scam</span>.
          </Title>
          <Subtitle>
            If you noticed a malware/scam link shortened by Kutt,{' '}
            <Link href="/report" to="report">
              <a href="/report" title="Send report">
                send us a report
              </a>
            </Link>.
          </Subtitle>
        </Wrapper>
        <Footer />
      </BodyWrapper>
    );
  }
}

export default withRedux(initialState)(BannedPage);
