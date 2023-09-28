"use client"

import React from "react";

import AppWrapper from "../../components/AppWrapper";
import { H2, H4, Span } from "../../components/Text";
import Footer from "../../components/Footer";
import ALink from "../../components/ALink";
import { Col } from "../../components/Layout";

import { publicRuntimeConfig } from '../../../next.config';

export default function BannedPage() {
  return (
    <AppWrapper>
      <Col flex="1 1 100%" alignItems="center">
        <H2 textAlign="center" my={3} normal>
          Link has been banned and removed because of{" "}
          <Span style={{ borderBottom: "1px dotted rgba(0, 0, 0, 0.4)" }} bold>
            malware or scam
          </Span>
          .
        </H2>
        <H4 textAlign="center" normal>
          If you noticed a malware/scam link shortened by{" "}
          {publicRuntimeConfig.SITE_NAME},{" "}
          <ALink href="/report" title="Send report" isNextLink>
            send us a report
          </ALink>
          .
        </H4>
      </Col>
      <Footer />
    </AppWrapper>
  );
};
