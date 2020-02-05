import { Flex } from "reflexbox/styled-components";
import Link from "next/link";
import React from "react";

import AppWrapper from "../components/AppWrapper";
import { H2, H4, Span } from "../components/Text";
import Footer from "../components/Footer";
import ALink from "../components/ALink";
import { Col } from "../components/Layout";

const BannedPage = () => {
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
          {process.env.SITE_NAME},{" "}
          <Link href="/report">
            <ALink title="Send report">send us a report</ALink>
          </Link>
          .
        </H4>
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default BannedPage;
