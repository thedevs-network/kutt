import React from 'react';
import styled from 'styled-components';

const Wrapper = styled.footer`
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 4px 0;
  background-color: white;

  a {
    text-decoration: none;
    color: #2196f3;
  }
`;

const Text = styled.p`
  font-size: 13px;
  font-weight: 300;
  color: #666;

  @media only screen and (max-width: 768px) {
    font-size: 11px;
  }
`;

const Footer = () => (
  <Wrapper>
    <Text>
      Made with love by{' '}
      <a href="//thedevs.network/" title="The Devs">
        The Devs
      </a>.{' | '}
      <a
        href="https://github.com/thedevs-network/kutt"
        title="GitHub"
        target="_blank" // eslint-disable-line react/jsx-no-target-blank
      >
        GitHub
      </a>
      {' | '}
      <a href="/terms" title="Terms of Service" target="_blank">
        Terms of Service
      </a>.
    </Text>
  </Wrapper>
);

export default Footer;
