import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import BodyWrapper from '../components/BodyWrapper';
import Footer from '../components/Footer';
import { authUser } from '../actions';
import Settings from '../components/Settings';

const SettingsPage = ({ isAuthenticated }) => (
  <BodyWrapper>
    {isAuthenticated ? <Settings /> : null}
    <Footer />
  </BodyWrapper>
);

SettingsPage.getInitialProps = ({ req, reduxStore }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && reduxStore) reduxStore.dispatch(authUser(token));
  return {};
};

SettingsPage.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ auth: { isAuthenticated } }) => ({ isAuthenticated });

export default connect(mapStateToProps)(SettingsPage);
