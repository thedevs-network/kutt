import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { decode } from 'jsonwebtoken';
import BodyWrapper from '../components/BodyWrapper';
import Footer from '../components/Footer';
import { authUser } from '../actions';
import Settings from '../components/Settings';

const SettingsPage = ({ auth, isAuthenticated }) => console.log({auth}) || (
  <BodyWrapper>
    {isAuthenticated ? <Settings /> : <PageLoading />}
    <Footer />
  </BodyWrapper>
);

SettingsPage.getInitialProps = ({ req, reduxStore }) => {
  const token = decode(req && req.cookies && req.cookies.token);
  if (token && reduxStore) reduxStore.dispatch(authUser(token));
  return {};
};

SettingsPage.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ auth }) => ({ isAuthenticated: auth.isAuthenticated, auth });

export default connect(mapStateToProps)(SettingsPage);
