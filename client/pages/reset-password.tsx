import { useFormState } from "react-use-form-state";
import React, { useEffect, useState } from "react";
import { Flex } from "rebass/styled-components";
import Router from "next/router";
import decode from "jwt-decode";
import { NextPage } from "next";
import cookie from "js-cookie";
import axios from "axios";

import { useStoreState, useStoreActions } from "../store";
import AppWrapper from "../components/AppWrapper";
import { TextInput } from "../components/Input";
import { Button } from "../components/Button";
import Text, { H2 } from "../components/Text";
import { Col } from "../components/Layout";
import { TokenPayload } from "../types";
import { useMessage } from "../hooks";
import Icon from "../components/Icon";
import { APIv2 } from "../consts";

interface Props {
  token?: string;
}

const ResetPassword: NextPage<Props> = ({ token }) => {
  const auth = useStoreState((s) => s.auth);
  const addAuth = useStoreActions((s) => s.auth.add);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useMessage();
  const [formState, { email, label }] = useFormState<{ email: string }>(null, {
    withIds: true
  });

  useEffect(() => {
    if (auth.isAuthenticated) {
      Router.push("/settings");
    }

    if (token) {
      cookie.set("token", token, { expires: 7 });
      const decoded: TokenPayload = decode(token);
      addAuth(decoded);
      Router.push("/settings");
    }
  }, [auth, token, addAuth]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!formState.validity.email) return;

    setLoading(true);
    setMessage();
    try {
      await axios.post(APIv2.AuthResetPassword, {
        email: formState.values.email
      });
      setMessage("Reset password email has been sent.", "green");
    } catch (error) {
      setMessage(error?.response?.data?.error || "Couldn't reset password.");
    }
    setLoading(false);
  };

  // FIXME: make a container for width
  return (
    <AppWrapper>
      <Col width={600} maxWidth="100%" px={3}>
        <H2 my={3} bold>
          Reset password
        </H2>
        <Text mb={4}>
          If you forgot you password you can use the form below to get reset
          password link.
        </Text>
        <Text {...label("homepage")} as="label" mt={2} fontSize={[15, 16]} bold>
          Email address
        </Text>
        <Flex
          as="form"
          alignItems="center"
          justifyContent="flex-start"
          onSubmit={onSubmit}
        >
          <TextInput
            {...email("email")}
            placeholder="Email address..."
            height={[44, 54]}
            width={[1, 1 / 2]}
            mr={3}
            autoFocus
            required
          />
          <Button type="submit" height={[40, 44]} my={3}>
            {loading && <Icon name={"spinner"} stroke="white" mr={2} />}
            Reset password
          </Button>
        </Flex>
        <Text fontSize={14} color={message.color} mt={2} normal>
          {message.text}
        </Text>
      </Col>
    </AppWrapper>
  );
};

ResetPassword.getInitialProps = async (ctx) => {
  return { token: ctx.req && (ctx.req as any).token };
};

export default ResetPassword;
