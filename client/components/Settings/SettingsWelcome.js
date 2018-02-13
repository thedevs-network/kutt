import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const Title = styled.h2`
  font-size: 28px;
  font-weight: 300;

  span {
    padding-bottom: 2px;
    border-bottom: 2px dotted #999;
  }

  @media only screen and (max-width: 768px) {
    font-size: 22px;
  }
`;

const SettingsWelcome = ({ user }) => (
  <Title>
    Welcome, <span>{user}</span>.
  </Title>
);

SettingsWelcome.propTypes = {
  user: PropTypes.string.isRequired,
};

export default SettingsWelcome;
