import React from 'react';
import PropTypes from 'prop-types';
import withRedux from 'next-redux-wrapper';
import initialState from '../store';
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

SettingsPage.getInitialProps = ({ req, store }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && store) store.dispatch(authUser(token));
};

SettingsPage.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
};

const mapStateToProps = ({ auth: { isAuthenticated } }) => ({ isAuthenticated });

export default withRedux(initialState, mapStateToProps)(SettingsPage);
