import React from "react";

import BodyWrapper from "../components/BodyWrapper";
import Settings from "../components/Settings";
import Footer from "../components/Footer";
import { useStoreState } from "../store";

const SettingsPage = () => {
  const { isAuthenticated } = useStoreState(s => s.auth);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <BodyWrapper>
      <Settings />
      <Footer />
    </BodyWrapper>
  );
};

export default SettingsPage;
