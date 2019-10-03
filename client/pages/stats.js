import React from 'react';
import PropTypes from 'prop-types';
import BodyWrapper from '../components/BodyWrapper';
import Stats from '../components/Stats';
import { authUser } from '../actions';

const StatsPage = ({ domain, id }) => (
  <BodyWrapper>
    <Stats domain={domain} id={id} />
  </BodyWrapper>
);

StatsPage.getInitialProps = ({ req, reduxStore, query }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && reduxStore) reduxStore.dispatch(authUser(token));
  return query;
};

StatsPage.propTypes = {
  domain: PropTypes.string,
  id: PropTypes.string,
};

StatsPage.defaultProps = {
  domain: '',
  id: '',
};

export default StatsPage;
