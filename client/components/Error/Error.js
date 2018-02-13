import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import styled, { css } from 'styled-components';
import { fadeIn } from '../../helpers/animations';

const ErrorMessage = styled.p`
  content: '';
  position: absolute;
  right: 36px;
  bottom: -64px;
  display: block;
  font-size: 14px;
  color: red;
  animation: ${fadeIn} 0.3s ease-out;

  @media only screen and (max-width: 768px) {
    right: 8px;
    bottom: -40px;
    font-size: 12px;
  }

  ${({ left }) =>
    left > -1 &&
    css`
      right: auto;
      left: ${left}px;
    `};

  ${({ bottom }) =>
    bottom &&
    css`
      bottom: ${bottom}px;
    `};
`;

const Error = ({ bottom, error, left, type }) => {
  const message = error[type] && (
    <ErrorMessage left={left} bottom={bottom}>
      {error[type]}
    </ErrorMessage>
  );
  return <div>{message}</div>;
};

Error.propTypes = {
  bottom: PropTypes.number,
  error: PropTypes.shape({
    auth: PropTypes.string.isRequired,
    shortener: PropTypes.string.isRequired,
  }).isRequired,
  type: PropTypes.string.isRequired,
  left: PropTypes.number,
};

Error.defaultProps = {
  bottom: -64,
  left: -1,
};

const mapStateToProps = ({ error }) => ({ error });

export default connect(mapStateToProps)(Error);
