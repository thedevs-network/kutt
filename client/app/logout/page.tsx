"use client"

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useStoreActions } from "../../store";

export default function LogoutPage() {
  const logout = useStoreActions((s) => s.auth.logout);
  const reset = useStoreActions((s) => s.reset);
  const router = useRouter();

  useEffect(() => {
    logout();
    reset();
    router.push("/");
  }, [logout, reset, router]);

  return <div />;
};
