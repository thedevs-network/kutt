import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Router from 'next/router';
import withRedux from 'next-redux-wrapper';
import styled, { css } from 'styled-components';
import cookie from 'js-cookie';
import axios from 'axios';
import initialState from '../store';
import BodyWrapper from '../components/BodyWrapper';
import TextInput from '../components/TextInput';
import Button from '../components/Button';
import { authUser } from '../actions';

const Form = styled.form`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  input {
    margin: 16px 0 32px;
  }
`;

const Message = styled.p`
  position: absolute;
  right: 0;
  bottom: 16px;
  font-size: 14px;
  color: green;

  ${({ error }) =>
    error &&
    css`
      color: red;
    `};

  @media only screen and (max-width: 768px) {
    bottom: 32px;
    font-size: 12px;
  }
`;

class ResetPassword extends Component {
  constructor() {
    super();
    this.state = {
      error: '',
      loading: false,
      success: '',
    };
    this.handleReset = this.handleReset.bind(this);
  }

  componentDidMount() {
    if (this.props.query || cookie.get('token')) {
      cookie.set('token', this.props.query.token, { expires: 7 });
      Router.push('/settings');
    }
  }

  handleReset(e) {
    if (this.state.loading) return null;
    e.preventDefault();
    const form = document.getElementById('reset-password-form');
    const { email: { value } } = form.elements;
    if (!value) {
      this.setState({ error: 'Please provide an Email address.' }, () => {
        setTimeout(() => {
          this.setState({ error: '' });
        }, 1500);
      });
    }
    this.setState({ loading: true });
    return axios
      .post('/api/auth/resetpassword', { email: value })
      .then(() =>
        this.setState({ success: 'Reset password email has been sent.', loading: false }, () => {
          setTimeout(() => {
            this.setState({ success: '' });
          }, 2500);
        })
      )
      .catch(() =>
        this.setState({ error: "Couldn't reset password", loading: false }, () => {
          setTimeout(() => {
            this.setState({ error: '' });
          }, 1500);
        })
      );
  }

  render() {
    const { error, loading, success } = this.state;
    return (
      <BodyWrapper>
        <Form id="reset-password-form" onSubmit={this.handleReset}>
          <TextInput type="email" name="email" id="email" placeholder="Email address" autoFocus />
          <Button onClick={this.handleReset} icon={loading ? 'loader' : ''} big>
            Reset password
          </Button>
          <Message error={!success && error}>
            {!success && error}
            {success}
          </Message>
        </Form>
      </BodyWrapper>
    );
  }
}

ResetPassword.getInitialProps = ({ store, query }) => {
  if (query && query.token) {
    store.dispatch(authUser(query.token));
    return { query };
  }
  return null;
};

ResetPassword.propTypes = {
  query: PropTypes.shape({
    token: PropTypes.string,
  }),
};

ResetPassword.defaultProps = {
  query: null,
};

export default withRedux(initialState)(ResetPassword);
