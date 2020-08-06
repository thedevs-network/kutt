import React, { FC, useEffect } from "react";
import getConfig from "next/config";

import showRecaptcha from "../helpers/recaptcha";
import { useStoreState } from "../store";
import { ColCenter } from "./Layout";
import ReCaptcha from "./ReCaptcha";
import ALink from "./ALink";
import Text from "./Text";
import { useTranslation } from 'react-i18next';

const { publicRuntimeConfig } = getConfig();

const Footer: FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useStoreState(s => s.auth);

  useEffect(() => {
    showRecaptcha();
  }, []);

  return (
    <ColCenter
      as="footer"
      width={1}
      backgroundColor="white"
      p={isAuthenticated ? 2 : 24}
    >
      {!isAuthenticated && <ReCaptcha />}
      <Text fontSize={[12, 13]} py={2}>
        {t('footer.made')}
        <ALink href="//thedevs.network/" title="The Devs">
        {t('footer.theDevs')}
        </ALink>
        .{" | "}
        <ALink
          href="https://github.com/thedevs-network/kutt"
          title="GitHub"
          target="_blank"
        >
          {t('footer.gitHub')}
        </ALink>
        {" | "}
        <ALink href="/terms" title="Terms of Service">
        {t('footer.termsOfService')}
        </ALink>
        {" | "}
        <ALink href="/report" title="Report abuse">
        {t('footer.report')}
        </ALink>
        {publicRuntimeConfig.CONTACT_EMAIL && (
          <>
            {" | "}
            <ALink
              href={`mailto:${publicRuntimeConfig.CONTACT_EMAIL}`}
              title="Contact us"
            >
              {t('footer.contact')}
            </ALink>
          </>
        )}
        .
      </Text>
    </ColCenter>
  );
};

export default Footer;
