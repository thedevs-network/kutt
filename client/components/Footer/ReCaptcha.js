import React from 'react';
import styled from 'styled-components';
import config from '../../config';

const Recaptcha = styled.div`
  display: flex;
  margin: 54px 0 16px;
`;

const ReCaptcha = () => (
  <Recaptcha
    id="g-recaptcha"
    className="g-recaptcha"
    data-sitekey={config.RECAPTCHA_SITE_KEY}
    data-callback="recaptchaCallback"
    data-size="invisible"
    data-badge="inline"
  />
);

export default ReCaptcha;
