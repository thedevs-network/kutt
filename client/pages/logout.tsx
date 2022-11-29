import React, { FC, useEffect } from "react";
import Router from "next/router";

import { useStoreActions } from "../store";

const LogoutPage: FC = () => {
  const logout = useStoreActions((s) => s.auth.logout);
  const reset = useStoreActions((s) => s.reset);

  useEffect(() => {
    logout();
    reset();
    Router.push("/");
  }, [logout, reset]);

  return <div />;
};

export default LogoutPage;
