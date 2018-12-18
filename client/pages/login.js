import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Router from 'next/router';
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

LoginPage.getInitialProps = ({ req, reduxStore }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && reduxStore) reduxStore.dispatch(authUser(token));
  return {};
};

LoginPage.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ auth: { isAuthenticated } }) => ({ isAuthenticated });

export default connect(mapStateToProps)(LoginPage);
