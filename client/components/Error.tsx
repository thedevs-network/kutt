import React, { FC } from 'react';
import { connect } from 'react-redux';
import styled, { css } from 'styled-components';
import { prop } from 'styled-tools';

import { fadeIn } from '../helpers/animations';

interface Message {
  bottom?: number;
  left?: number;
}

interface Props extends Message {
  error: any;
  type: string;
}

const ErrorMessage = styled.p<Message>`
  content: '';
  position: absolute;
  right: 36px;
  bottom: ${prop('bottom', -64)}px;
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
`;

const Error: FC<Props> = ({ bottom, error, left, type }) => {
  const message = error[type] && (
    <ErrorMessage left={left} bottom={bottom}>
      {error[type]}
    </ErrorMessage>
  );
  return <div>{message}</div>;
};

Error.defaultProps = {
  bottom: -64,
  left: -1,
};

const mapStateToProps = ({ error }) => ({ error });

export default connect(mapStateToProps)(Error);
