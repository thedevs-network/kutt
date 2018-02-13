import React, { Component } from 'react';
import PropTypes from 'prop-types';
import withRedux from 'next-redux-wrapper';
import Router from 'next/router';
import initialState from '../store';
import BodyWrapper from '../components/BodyWrapper';
import Login from '../components/Login';
import { authUser } from '../actions';

class LoginPage extends Component {
  componentDidMount() {
    if (this.props.isAuthenticated) {
      Router.push('/');
    }
  }

  render() {
    return (
      !this.props.isAuthenticated && (
        <BodyWrapper>
          <Login />
        </BodyWrapper>
      )
    );
  }
}

LoginPage.getInitialProps = ({ req, store }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && store) store.dispatch(authUser(token));
};

LoginPage.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ auth: { isAuthenticated } }) => ({ isAuthenticated });

export default withRedux(initialState, mapStateToProps)(LoginPage);
