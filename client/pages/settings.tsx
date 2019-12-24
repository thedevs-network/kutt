import { Flex } from "reflexbox/styled-components";
import { NextPage } from "next";
import React, { useState, useEffect } from "react";

import SettingsPassword from "../components/Settings/SettingsPassword";
import SettingsDomain from "../components/Settings/SettingsDomain";
import SettingsBan from "../components/Settings/SettingsBan";
import SettingsApi from "../components/Settings/SettingsApi";
import BodyWrapper from "../components/BodyWrapper";
import Divider from "../components/Divider";
import Footer from "../components/Footer";
import { useStoreState, useStoreActions } from "../store";
import Text from "../components/Text";

const SettingsPage: NextPage = () => {
  const { isAuthenticated, email, isAdmin } = useStoreState(s => s.auth);
  const getSettings = useStoreActions(s => s.settings.getSettings);

  useEffect(() => {
    getSettings();
  }, []);

  return (
    <BodyWrapper>
      <Flex
        width={600}
        maxWidth="90%"
        flexDirection="column"
        alignItems="flex-start"
        pb={80}
        mt={4}
      >
        <Text as="h1" alignItems="center" fontWeight={300} fontSize={[24, 28]}>
          Welcome,{" "}
          <Text as="span" pb="2px" style={{ borderBottom: "2px dotted #999" }}>
            {email}
          </Text>
          .
        </Text>
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
      </Flex>
      <Footer />
    </BodyWrapper>
  );
};

export default SettingsPage;
