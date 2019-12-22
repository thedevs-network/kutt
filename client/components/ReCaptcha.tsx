import React from 'react';
import styled from 'styled-components';
import { Flex } from 'reflexbox/styled-components';

const ReCaptcha = () => {
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  return (
    <Flex
      margin="54px 0 16px"
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
