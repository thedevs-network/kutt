import React, { Component } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import axios from 'axios';
import BodyWrapper from '../components/BodyWrapper';
import TextInput from '../components/TextInput';
import Button from '../components/Button';

const Title = styled.h3`
  font-size: 24px;
  font-weight: 300;
  text-align: center;

  @media only screen and (max-width: 448px) {
    font-size: 18px;
  }
`;

const Form = styled.form`
  position: relative;
  display: flex;
  align-items: center;
`;

const Error = styled.p`
  position: absolute;
  left: 0;
  bottom: -48px;
  font-size: 14px;
  color: red;

  @media only screen and (max-width: 448px) {
    bottom: -40px;
    font-size: 12px;
  }
`;

class UrlPasswordPage extends Component {
  static getInitialProps({ query }) {
    return { query };
  }

  constructor() {
    super();
    this.state = {
      error: '',
      loading: false,
      password: '',
    };
    this.updatePassword = this.updatePassword.bind(this);
    this.requestUrl = this.requestUrl.bind(this);
  }

  shouldComponentUpdate() {
    return true;
  }

  updatePassword(e) {
    this.setState({
      password: e.currentTarget.value,
    });
  }

  requestUrl(e) {
    e.preventDefault();
    const { password } = this.state;
    const { protectedLink } = this.props.query;
    if (!password) {
      return this.setState({
        error: 'Password must not be empty',
      });
    }
    this.setState({ error: '' });
    this.setState({ loading: true });
    return axios
      .post('/api/url/requesturl', { id: protectedLink, password })
      .then(({ data }) => window.location.replace(data.target))
      .catch(({ response }) =>
        this.setState({
          loading: false,
          error: response.data.error,
        })
      );
  }

  render() {
    if (!this.props.query.protectedLink) {
      return (
        <BodyWrapper>
          <Title>404 | Not found.</Title>
        </BodyWrapper>
      );
    }
    return (
      <BodyWrapper>
        <Title>Enter the password to access the URL.</Title>
        <Form onSubmit={this.requestUrl}>
          <TextInput type="password" placeholder="Password" onChange={this.updatePassword} small />
          <Button type="submit" icon={this.state.loading ? 'loader' : ''}>
            Go
          </Button>
          <Error>{this.state.error}</Error>
        </Form>
      </BodyWrapper>
    );
  }
}

UrlPasswordPage.propTypes = {
  query: PropTypes.shape({
    protectedLink: PropTypes.string,
  }),
};

UrlPasswordPage.defaultProps = {
  query: {},
};

export default UrlPasswordPage;
