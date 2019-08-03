import React, { Component } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
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
  font-size: 28px;
  font-weight: 300;
  text-align: center;
  margin: 24px 0;

  @media only screen and (max-width: 448px) {
    font-size: 18px;
  }
`;

const Target = styled.h3`
  font-size: 18px;
  text-align: center;

  @media only screen and (max-width: 448px) {
    font-size: 16px;
  }
`;

class UrlInfoPage extends Component {
  static getInitialProps({ query, req, reduxStore }) {
    const token = req && req.cookies && req.cookies.token;
    if (token && reduxStore) reduxStore.dispatch(authUser(token));
    return { query };
  }

  render() {
    if (!this.props.query.linkTarget) {
      return (
        <BodyWrapper>
          <Title>404 | Not found.</Title>
        </BodyWrapper>
      );
    }

    return (
      <BodyWrapper>
        <Wrapper>
          <Title>Target:</Title>
          <Target>{this.props.query.linkTarget}</Target>
        </Wrapper>
        <Footer />
      </BodyWrapper>
    );
  }
}

UrlInfoPage.propTypes = {
  query: PropTypes.shape({
    linkTarget: PropTypes.string,
  }),
};

UrlInfoPage.defaultProps = {
  query: {},
};

export default UrlInfoPage;
