import { Flex } from "reflexbox/styled-components";
import React, { useEffect } from "react";
import { NextPage } from "next";

import SettingsPassword from "../components/Settings/SettingsPassword";
import SettingsDomain from "../components/Settings/SettingsDomain";
import SettingsBan from "../components/Settings/SettingsBan";
import SettingsApi from "../components/Settings/SettingsApi";
import { useStoreState, useStoreActions } from "../store";
import AppWrapper from "../components/AppWrapper";
import { H1, Span } from "../components/Text";
import Divider from "../components/Divider";
import Footer from "../components/Footer";
import { Col } from "../components/Layout";

const SettingsPage: NextPage = props => {
  const { email, isAdmin } = useStoreState(s => s.auth);
  const getSettings = useStoreActions(s => s.settings.getSettings);

  useEffect(() => {
    getSettings();
  }, [false]);

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
        <Divider my={[4, 48]} />
        {isAdmin && (
          <>
            <SettingsBan />
            <Divider my={[12, 24]} />
          </>
        )}
        <SettingsDomain />
        <Divider my={[12, 24]} />
        <SettingsPassword />
        <Divider my={[12, 24]} />
        <SettingsApi />
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default SettingsPage;
