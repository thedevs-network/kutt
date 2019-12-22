import React, { FC, useEffect } from 'react';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Flex } from 'reflexbox/styled-components';

import ReCaptcha from './ReCaptcha';
import showRecaptcha from '../helpers/recaptcha';
import { ifProp } from 'styled-tools';

interface Props {
  isAuthenticated: boolean;
}

const Wrapper = styled(Flex).attrs({
  as: 'footer',
  width: 1,
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
})<Props>`
  padding: 4px 0 ${ifProp('isAuthenticated', '8px', '24px')};
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

const Footer: FC<Props> = ({ isAuthenticated }) => {
  useEffect(() => {
    showRecaptcha();
  }, []);

  return (
    <Wrapper isAuthenticated={isAuthenticated}>
      {!isAuthenticated && <ReCaptcha />}
      <Text>
        Made with love by{' '}
        <a href="//thedevs.network/" title="The Devs">
          The Devs
        </a>
        .{' | '}
        <a
          href="https://github.com/thedevs-network/kutt"
          title="GitHub"
          target="_blank"
        >
          GitHub
        </a>
        {' | '}
        <a href="/terms" title="Terms of Service">
          Terms of Service
        </a>
        {' | '}
        <a href="/report" title="Report abuse">
          Report Abuse
        </a>
        {process.env.CONTACT_EMAIL && (
          <>
            {' | '}
            <a href={`mailto:${process.env.CONTACT_EMAIL}`} title="Contact us">
              Contact us
            </a>
          </>
        )}
        .
      </Text>
    </Wrapper>
  );
};

const mapStateToProps = ({ auth: { isAuthenticated } }) => ({
  isAuthenticated,
});

export default connect(mapStateToProps)(Footer);
