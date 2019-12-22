import React, { FC } from 'react';
import styled from 'styled-components';

interface Props {
  user: string;
}

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

const SettingsWelcome: FC<Props> = ({ user }) => (
  <Title>
    Welcome, <span>{user}</span>.
  </Title>
);

export default SettingsWelcome;
