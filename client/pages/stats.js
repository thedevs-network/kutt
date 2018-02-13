import React from 'react';
import PropTypes from 'prop-types';
import withRedux from 'next-redux-wrapper';
import initialState from '../store';
import BodyWrapper from '../components/BodyWrapper';
import Stats from '../components/Stats';
import { authUser } from '../actions';

const StatsPage = ({ id }) => (
  <BodyWrapper>
    <Stats id={id} />
  </BodyWrapper>
);

StatsPage.getInitialProps = ({ req, store, query }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && store) store.dispatch(authUser(token));
  return { id: query && query.id };
};

StatsPage.propTypes = {
  id: PropTypes.string,
};

StatsPage.defaultProps = {
  id: '',
};

export default withRedux(initialState)(StatsPage);
