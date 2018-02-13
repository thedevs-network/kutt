import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { fadeIn } from '../../helpers/animations';

const Box = styled.form`
  position: relative;
  flex-basis: 400px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: stretch;
  animation: ${fadeIn} 0.8s ease-out;

  input {
    margin-bottom: 48px;
  }
  @media only screen and (max-width: 768px) {
    input {
      margin-bottom: 32px;
    }
  }
`;

const LoginBox = ({ children, ...props }) => <Box {...props}>{children}</Box>;

LoginBox.propTypes = {
  children: PropTypes.node.isRequired,
};

export default LoginBox;
