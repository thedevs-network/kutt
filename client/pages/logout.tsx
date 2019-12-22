import React, { FC, useEffect } from "react";

import { useStoreActions } from "../store";

const LogoutPage: FC = () => {
  const logout = useStoreActions(s => s.auth.logout);

  useEffect(() => logout(), []);

  return <div />;
};

export default LogoutPage;
