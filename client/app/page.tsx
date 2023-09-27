"use client"

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import { DISALLOW_ANONYMOUS_LINKS } from "../consts";
import NeedToLogin from "../components/NeedToLogin";
import Extensions from "../components/Extensions";
import LinksTable from "../components/LinksTable";
import AppWrapper from "../components/AppWrapper";
import Shortener from "../components/Shortener";
import Features from "../components/Features";
import Footer from "../components/Footer";
import { useStoreActions, useStoreState } from "../store";
import cookie from "js-cookie";

export default function Home() {
  const isAuthenticated = useStoreState(s => s.auth.isAuthenticated);
  const { renew, logout } = useStoreActions(s => s.auth);
  const router = useRouter();

  useEffect(() => {
    const token = cookie.get("token");
    const isVerifyEmailPage =
      typeof window !== "undefined" &&
      window.location.pathname.includes("verify-email");

    if (token && !isVerifyEmailPage) {
      renew().catch(() => {
        logout();
      });
    }
  }, [logout, renew]);

  if (
    !isAuthenticated &&
    DISALLOW_ANONYMOUS_LINKS &&
    typeof window !== "undefined"
  ) {
    router.push("/login");
    return null;
  }

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
}
