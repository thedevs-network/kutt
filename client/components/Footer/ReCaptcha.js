import React from 'react';
import styled from 'styled-components';

const Recaptcha = styled.div`
  display: flex;
  margin: 54px 0 16px;
`;

const ReCaptcha = () => {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <Recaptcha
      id="g-recaptcha"
      className="g-recaptcha"
      data-sitekey={process.env.RECAPTCHA_SITE_KEY}
      data-callback="recaptchaCallback"
      data-size="invisible"
      data-badge="inline"
    />
  );
};

export default ReCaptcha;
