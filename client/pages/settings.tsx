import { NextPage } from "next";
import React from "react";

import SettingsDeleteAccount from "../components/Settings/SettingsDeleteAccount";
import SettingsPassword from "../components/Settings/SettingsPassword";
import SettingsDomain from "../components/Settings/SettingsDomain";
import SettingsApi from "../components/Settings/SettingsApi";
import AppWrapper from "../components/AppWrapper";
import { H1, Span } from "../components/Text";
import Divider from "../components/Divider";
import { Col } from "../components/Layout";
import Footer from "../components/Footer";
import { useStoreState } from "../store";

const SettingsPage: NextPage = () => {
  const email = useStoreState(s => s.auth.email);

  return (
    <AppWrapper>
      <Col width={600} maxWidth="90%" alignItems="flex-start" pb={80} mt={4}>
        <H1 alignItems="center" fontSize={[24, 28]} light>
          Welcome,{" "}
          <Span pb="2px" style={{ borderBottom: "2px dotted #999" }}>
            {email}
          </Span>
          .
        </H1>
        <Divider mt={4} mb={48} />
        <SettingsDomain />
        <Divider mt={4} mb={48} />
        <SettingsPassword />
        <Divider mt={4} mb={48} />
        <SettingsApi />
        <Divider mt={4} mb={48} />
        <SettingsDeleteAccount />
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default SettingsPage;
