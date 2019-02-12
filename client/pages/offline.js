import React, { Component } from 'react';
import styled from 'styled-components';
import BodyWrapper from '../components/BodyWrapper';

const Wrapper = styled.h2`
  font-size: 24px;
  font-weight: 300;
  position: absolute;
  text-align: center;
  top: 40vh;
  padding-left: 10px;
  padding-right: 10px;
`;

// eslint-disable-next-line react/prefer-stateless-function
class OfflinePage extends Component {
  render() {
    return (
      <BodyWrapper>
        <Wrapper>
          Please check your <b>internet connection</b> and try again. <br />
          You are <b>offline</b> right now.
        </Wrapper>
      </BodyWrapper>
    );
  }
}

export default OfflinePage;
