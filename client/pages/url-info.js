import React, { Component } from 'react';
import PropTypes from 'prop-types';
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
  static getInitialProps({ query, req, store }) {
    const token = req && req.cookies && req.cookies.token;
    if (token && store) store.dispatch(authUser(token));
    return { query };
  }

  render() {
    if (!this.props.query) {
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
          <Target>{this.props.query}</Target>
        </Wrapper>
        <Footer />
      </BodyWrapper>
    );
  }
}

UrlInfoPage.propTypes = {
  query: PropTypes.string,
};

UrlInfoPage.defaultProps = {
  query: null,
};

export default withRedux(initialState)(UrlInfoPage);
