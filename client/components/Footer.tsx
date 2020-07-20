import React, { FC, useEffect } from "react";

import showRecaptcha from "../helpers/recaptcha";
import { useStoreState } from "../store";
import { ColCenter } from "./Layout";
import ReCaptcha from "./ReCaptcha";
import ALink from "./ALink";
import Text from "./Text";
import { useTranslation } from 'react-i18next';

const Footer: FC = () => {
  const { t, i18n } = useTranslation();
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
        {process.env.CONTACT_EMAIL && (
          <>
            {" | "}
            <ALink
              href={`mailto:${process.env.CONTACT_EMAIL}`}
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
