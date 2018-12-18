import React from 'react';
import PropTypes from 'prop-types';
import BodyWrapper from '../components/BodyWrapper';
import Stats from '../components/Stats';
import { authUser } from '../actions';

const StatsPage = ({ id }) => (
  <BodyWrapper>
    <Stats id={id} />
  </BodyWrapper>
);

StatsPage.getInitialProps = ({ req, reduxStore, query }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && reduxStore) reduxStore.dispatch(authUser(token));
  return { id: query && query.id };
};

StatsPage.propTypes = {
  id: PropTypes.string,
};

StatsPage.defaultProps = {
  id: '',
};

export default StatsPage;
