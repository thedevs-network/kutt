import React, { useEffect } from "react";
import { Flex } from "rebass/styled-components";
import decode from "jwt-decode";
import { NextPage } from "next";
import cookie from "js-cookie";

import { useStoreActions } from "../store";
import AppWrapper from "../components/AppWrapper";
import { H2 } from "../components/Text";
import { TokenPayload } from "../types";
import Icon from "../components/Icon";
import { Colors } from "../consts";
import Footer from "../components/Footer";

interface Props {
  token?: string;
}

const VerifyEmail: NextPage<Props> = ({ token }) => {
  const addAuth = useStoreActions((s) => s.auth.add);

  useEffect(() => {
    if (token) {
      cookie.set("token", token, { expires: 7 });
      const decoded: TokenPayload = decode(token);
      addAuth(decoded);
    }
  }, [addAuth, token]);

  return (
    <AppWrapper>
      <Flex flex="1 1 100%" justifyContent="center" mt={4}>
        <Icon
          name={token ? "check" : "x"}
          size={26}
          stroke={token ? Colors.CheckIcon : Colors.TrashIcon}
          mr={3}
          mt={1}
        />
        <H2 textAlign="center" normal>
          {token
            ? "Email address verified successfully."
            : "Couldn't verify the email address."}
        </H2>
      </Flex>
      <Footer />
    </AppWrapper>
  );
};

VerifyEmail.getInitialProps = async (ctx) => {
  return { token: (ctx?.req as any)?.token };
};

export default VerifyEmail;
