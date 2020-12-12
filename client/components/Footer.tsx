import React, { FC, useEffect } from "react";
import getConfig from "next/config";

import showRecaptcha from "../helpers/recaptcha";
import { useStoreState } from "../store";
import { ColCenter } from "./Layout";
import ReCaptcha from "./ReCaptcha";
import ALink from "./ALink";
import Text from "./Text";

const { publicRuntimeConfig } = getConfig();

const Divider = () => (
  <span
    css={`
      color: inherit;
      color: var(--color-footer-divider);
    `}
  >
    {" | "}
  </span>
);

const Footer: FC = () => {
  const { isAuthenticated } = useStoreState(s => s.auth);

  useEffect(() => {
    showRecaptcha();
  }, []);

  return (
    <ColCenter as="footer" width={1} p={isAuthenticated ? 2 : 24}>
      {!isAuthenticated && <ReCaptcha />}
      <Text fontSize={[12, 13]} py={2}>
        Made with love by{" "}
        <ALink href="//thedevs.network/" title="The Devs">
          The Devs
        </ALink>
        . <Divider />
        <ALink
          href="https://github.com/thedevs-network/kutt"
          title="GitHub"
          target="_blank"
        >
          GitHub
        </ALink>
        <Divider />
        <ALink href="/terms" title="Terms of Service">
          Terms of Service
        </ALink>
        <Divider />
        <ALink href="/report" title="Report abuse">
          Report Abuse
        </ALink>
        {publicRuntimeConfig.CONTACT_EMAIL && (
          <>
            <Divider />
            <ALink
              href={`mailto:${publicRuntimeConfig.CONTACT_EMAIL}`}
              title="Contact us"
            >
              Contact us
            </ALink>
          </>
        )}
        .
      </Text>
    </ColCenter>
  );
};

export default Footer;
