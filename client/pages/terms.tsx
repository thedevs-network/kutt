import React from "react";
import { Flex } from "reflexbox/styled-components";

import AppWrapper from "../components/AppWrapper";
import { Col } from "../components/Layout";
import { useTranslation } from 'react-i18next';

const TermsPage = () => {
  const { t } = useTranslation("terms");

  return (
    <AppWrapper>
      {/* TODO: better container */}
      <Col width={600} maxWidth="97%" alignItems="flex-start">
        <h3>{process.env.SITE_NAME + t('title')}</h3>
        <p>
          {t('p1.1')}
          <a href={`https://${process.env.DEFAULT_DOMAIN}`}>
            https://{process.env.DEFAULT_DOMAIN}
          </a>
          {t('p1.2')}
      </p>
        <p>
          {t('p2.1')}
          {process.env.SITE_NAME}{t('p2.2')}
          {process.env.DEFAULT_DOMAIN}{t('p2.3')}
          {process.env.SITE_NAME}{t('p2.4')}
          {process.env.SITE_NAME}{t('p2.5')}
        </p>
        <p>
          {t('p3.1')}
          {process.env.SITE_NAME}{t('p3.2')}
          {process.env.SITE_NAME}{t('p3.3')}
          {process.env.SITE_NAME}{t('p3.4')}
          {process.env.SITE_NAME}{t('p3.5')}
        </p>
        <p>
          {process.env.SITE_NAME}{t('p4.1')}
          {process.env.SITE_NAME}{t('p4.2')}
        </p>
        <p>
          {process.env.SITE_NAME}{t('p5.1')}
        </p>
      </Col>
    </AppWrapper>
  );
}

export default TermsPage;
