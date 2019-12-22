import React from "react";
import Link from "next/link";
import { Flex } from "reflexbox/styled-components";

import BodyWrapper from "../components/BodyWrapper";
import Footer from "../components/Footer";
import Text from "../components/Text";
import ALink from "../components/ALink";

const BannedPage = () => {
  return (
    <BodyWrapper>
      <Flex flex="1 1 100%" flexDirection="column" alignItems="center">
        <Text as="h2" textAlign="center" my={3} fontWeight={400}>
          Link has been banned and removed because of{" "}
          <Text
            as="span"
            fontWeight={700}
            style={{ borderBottom: "1px dotted rgba(0, 0, 0, 0.4)" }}
          >
            malware or scam
          </Text>
          .
        </Text>
        <Text as="h4" textAlign="center" fontWeight={400}>
          If you noticed a malware/scam link shortened by Kutt,{" "}
          <Link href="/report">
            <ALink title="Send report">send us a report</ALink>
          </Link>
          .
        </Text>
      </Flex>
      <Footer />
    </BodyWrapper>
  );
};

export default BannedPage;
