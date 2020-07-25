import { Flex } from "reflexbox/styled-components";
import styled from "styled-components";
import getConfig from "next/config";
import React from "react";

const { publicRuntimeConfig } = getConfig();

const ReCaptcha = () => {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

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
