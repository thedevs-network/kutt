import getConfig from "next/config";
import React from "react";
import styled from "styled-components";

import AppWrapper from "../components/AppWrapper";
import { Col } from "../components/Layout";
import { useTranslation } from 'react-i18next';

const { publicRuntimeConfig } = getConfig();

const Text = styled.p`
  Text-align: justify;
`;

const TermsPage = () => {
  const { t } = useTranslation("terms");

  return (
    <AppWrapper>
      {/* TODO: better container */}
      <Col width={600} maxWidth="97%" alignItems="flex-start">
        <h3>{publicRuntimeConfig.SITE_NAME+ t('title')}</h3>
        <Text>
          {t('p1.1')}
          <a href={`https://${publicRuntimeConfig.DEFAULT_DOMAIN}`}>
            https://{publicRuntimeConfig.DEFAULT_DOMAIN}
          </a>
          {t('p1.2')}
      </Text>
        <Text>
          {t('p2.1')}
          {publicRuntimeConfig.SITE_NAME}{t('p2.2')}
          {publicRuntimeConfig.DEFAULT_DOMAIN}{t('p2.3')}
          {publicRuntimeConfig.SITE_NAME}{t('p2.4')}
          {publicRuntimeConfig.SITE_NAME}{t('p2.5')}
        </Text>
        <Text>
          {t('p3.1')}
          {publicRuntimeConfig.SITE_NAME}{t('p3.2')}
          {publicRuntimeConfig.SITE_NAME}{t('p3.3')}
          {publicRuntimeConfig.SITE_NAME}{t('p3.4')}
          {publicRuntimeConfig.SITE_NAME}{t('p3.5')}
        </Text>
        <Text>
          {publicRuntimeConfig.SITE_NAME}{t('p4.1')}
          {publicRuntimeConfig.SITE_NAME}{t('p4.2')}
        </Text>
        <Text>
          {publicRuntimeConfig.SITE_NAME}{t('p5.1')}
        </Text>
      </Col>
    </AppWrapper>
  );
}

export default TermsPage;
