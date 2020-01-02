import React from "react";

import NeedToLogin from "../components/NeedToLogin";
import Extensions from "../components/Extensions";
import LinksTable from "../components/LinksTable";
import AppWrapper from "../components/AppWrapper";
import Shortener from "../components/Shortener";
import Features from "../components/Features";
import Footer from "../components/Footer";
import { useStoreState } from "../store";

const Homepage = () => {
  const isAuthenticated = useStoreState(s => s.auth.isAuthenticated);

  return (
    <AppWrapper>
      <Shortener />
      {!isAuthenticated && <NeedToLogin />}
      {isAuthenticated && <LinksTable />}
      <Features />
      <Extensions />
      <Footer />
    </AppWrapper>
  );
};

export default Homepage;
