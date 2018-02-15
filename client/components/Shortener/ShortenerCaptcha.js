import React from 'react';
import styled from 'styled-components';
import config from '../../config';

const Recaptcha = styled.div`
  display: block;
  margin: 32px 0;
`;

const ShortenerCaptcha = () => (
  <Recaptcha
    id="g-recaptcha"
    className="g-recaptcha"
    data-sitekey={config.RECAPTCHA_SITE_KEY}
    data-callback="recaptchaCallback"
  />
);

export default ShortenerCaptcha;
