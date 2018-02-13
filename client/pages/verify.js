import React from 'react';
import PropTypes from 'prop-types';
import Router from 'next/router';
import withRedux from 'next-redux-wrapper';
import { bindActionCreators } from 'redux';
import styled from 'styled-components';
import cookie from 'js-cookie';
import initialState from '../store';
import BodyWrapper from '../components/BodyWrapper';
import { authRenew, authUser, showPageLoading } from '../actions';
import Button from '../components/Button';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const MessageWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 32px 0;
`;

const Message = styled.p`
  font-size: 24px;
  font-weight: 300;

  @media only screen and (max-width: 768px) {
    font-size: 18px;
  }
`;

const Icon = styled.img`
  width: 32px;
  height: 32px;
  margin-right: 16px;

  @media only screen and (max-width: 768px) {
    width: 26px;
    height: 26px;
    margin-right: 8px;
  }
`;

const Verify = ({ showLoading, query }) => {
  if (query) {
    cookie.set('token', query.token, { expires: 7 });
  }

  const goToHomepage = e => {
    e.preventDefault();
    showLoading();
    Router.push('/');
  };

  const message = query ? (
    <Wrapper>
      <MessageWrapper>
        <Icon src="/images/check.svg" />
        <Message>Your account has been verified successfully!</Message>
      </MessageWrapper>
      <Button icon="arrow-left" onClick={goToHomepage}>
        Back to homepage
      </Button>
    </Wrapper>
  ) : (
    <MessageWrapper>
      <Icon src="/images/x.svg" />
      <Message>Invalid verification.</Message>
    </MessageWrapper>
  );
  return <BodyWrapper norenew>{message}</BodyWrapper>;
};

Verify.getInitialProps = ({ store, query }) => {
  if (query && query.token) {
    store.dispatch(authUser(query.token));
    store.dispatch(authRenew());
    return { query };
  }
  return null;
};

Verify.propTypes = {
  query: PropTypes.shape({
    token: PropTypes.string,
  }),
  showLoading: PropTypes.func.isRequired,
};

Verify.defaultProps = {
  query: null,
};

const mapDispatchToProps = dispatch => ({
  showLoading: bindActionCreators(showPageLoading, dispatch),
});

export default withRedux(initialState, null, mapDispatchToProps)(Verify);
