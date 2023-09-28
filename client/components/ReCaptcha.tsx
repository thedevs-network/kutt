import { Flex } from "rebass/styled-components";
import React from "react";

import { publicRuntimeConfig } from '../../next.config';

const ReCaptcha = () => {
  if (process.env.NODE_ENV !== "production") return null;
  if (!publicRuntimeConfig.RECAPTCHA_SITE_KEY) return null;

  return (
    <Flex
      margin="54px 0 16px"
      id="g-recaptcha"
      className="g-recaptcha"
      data-sitekey={publicRuntimeConfig.RECAPTCHA_SITE_KEY}
      data-callback="recaptchaCallback"
      data-size="invisible"
      data-badge="inline"
    />
  );
};

export default ReCaptcha;
