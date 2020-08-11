import getConfig from "next/config";
import Link from "next/link";
import React from "react";

import AppWrapper from "../components/AppWrapper";
import { H2, H4, Span } from "../components/Text";
import Footer from "../components/Footer";
import ALink from "../components/ALink";
import { Col } from "../components/Layout";
import { useTranslation } from 'react-i18next';

const { publicRuntimeConfig } = getConfig();

const BannedPage = () => {
  const { t } = useTranslation("banned");
  return (
    <AppWrapper>
      <Col flex="1 1 100%" alignItems="center">
        <H2 textAlign="center" my={3} normal>
          {t('title1')}
          <Span style={{ borderBottom: "1px dotted rgba(0, 0, 0, 0.4)" }} bold>
            {t('title2')}
          </Span>
          .
        </H2>
        <H4 textAlign="center" normal>
          {t('description1')}
          {publicRuntimeConfig.SITE_NAME},{" "}
          <Link href="/report">
            <ALink title="Send report">{t('description2')}</ALink>
          </Link>
          .
        </H4>
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default BannedPage;
