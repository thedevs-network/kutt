/* eslint-disable jsx-a11y/label-has-for */
import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';

const Label = styled.div`
  margin-bottom: 8px;
`;

const LoginInputLabel = ({ children, htmlFor }) => (
  <Label>
    <label htmlFor={htmlFor}>{children}</label>
  </Label>
);

LoginInputLabel.propTypes = {
  children: PropTypes.node.isRequired,
  htmlFor: PropTypes.string.isRequired,
};

export default LoginInputLabel;
