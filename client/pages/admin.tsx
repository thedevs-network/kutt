import { NextPage } from "next";
import React, { useEffect, useState } from "react";

import SettingsDeleteAccount from "../components/Settings/SettingsDeleteAccount";
import SettingsChangeEmail from "../components/Settings/SettingsChangeEmail";
import SettingsPassword from "../components/Settings/SettingsPassword";
import SettingsDomain from "../components/Settings/SettingsDomain";
import SettingsApi from "../components/Settings/SettingsApi";
import AppWrapper from "../components/AppWrapper";
import Text, { H1, H2, Span } from "../components/Text";
import Divider from "../components/Divider";
import { Col } from "../components/Layout";
import Footer from "../components/Footer";
import { useStoreActions, useStoreState } from "../store";
import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import emailValidator from "email-validator";
import styled, { css } from "styled-components";
import Router from "next/router";
import Link from "next/link";
import axios from "axios";

import { APIv2, Colors, DISALLOW_REGISTRATION } from "../consts";
import { ColCenterV } from "../components/Layout";
import { Checkbox, TextInput } from "../components/Input";
import { fadeIn } from "../helpers/animations";
import { Button } from "../components/Button";
import ALink from "../components/ALink";
import Icon from "../components/Icon";
import { getAxiosConfig } from "../utils";
import Modal from "../components/Modal";
import Table from "../components/Table";
import { ifProp } from "styled-tools";
import UsersTable from "../components/UserTable";

//const res = await axios.post(APIv2.AuthLogin, payload);

const AdminPage: NextPage = () => {
  const email = useStoreState(s => s.auth.email);

  return (
    <AppWrapper>
      <Col
        width={1200}
        maxWidth="95%"
        alignItems="flex-start"
        pb={80}
        my={4}
        height="100%"
      >
        <H1 alignItems="center" fontSize={[24, 28]} light>
          Welcome,{" "}
          <Span pb="2px" style={{ borderBottom: "2px dotted #999" }}>
            {email}
          </Span>
          .
        </H1>
        <Divider mt={4} mb={48} />

        <Users />
        <UsersTable />
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default AdminPage;

const Users = () => {
  const [showCreateUser, setShowCreateUser] = useState(false);

  return (
    <Flex justifyContent="space-between" width="100%">
      <H2 mb={4} bold>
        Users
      </H2>
      <Button
        height={[32, 40]}
        color="purple"
        onClick={() => setShowCreateUser(true)}
      >
        New User
      </Button>
      <Modal
        id="delete-custom-domain"
        show={showCreateUser}
        closeHandler={() => setShowCreateUser(false)}
      >
        <CreateNewUser />
      </Modal>
    </Flex>
  );
};

const LoginForm = styled(Flex).attrs({
  as: "form",
  flexDirection: "column"
})`
  animation: ${fadeIn} 0.8s ease-out;
`;

const Email = styled.span`
  font-weight: normal;
  color: #512da8;
  border-bottom: 1px dotted #999;
`;

const CreateNewUser = () => {
  const { isAuthenticated, isAdmin } = useStoreState(s => s.auth);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formState, { email, password, label }] = useFormState<{
    email: string;
    password: string;
  }>(null, { withIds: true });

  useEffect(() => {
    if (!isAuthenticated) Router.push("/");
  }, [isAuthenticated]);

  function onSubmit() {
    return async e => {
      e.preventDefault();
      const { email, password } = formState.values;

      if (loading) return null;

      if (!email) {
        return setError("Email address must not be empty.");
      }

      if (!emailValidator.validate(email)) {
        return setError("Email address is not valid.");
      }

      if (password.trim().length < 8) {
        return setError("Password must be at least 8 chars long.");
      }

      setError("");

      setLoading(true);
      try {
        const res = await axios.post(
          APIv2.AdminCreateUser,
          formState.values,
          getAxiosConfig()
        );
        setVerifying(true);
      } catch (error) {
        setError(error.response.data.error);
      }

      setLoading(false);
    };
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <ColCenterV maxWidth="100%" px={3} flex="0 0 auto" mt={4}>
      {verifying ? (
        <Col>
          <H2 textAlign="center" light>
            A verification email has been sent to{" "}
            <Email>{formState.values.email}</Email>.
          </H2>
          <Button
            flex="1 1 auto"
            ml={["8px", 16]}
            height={[44, 56]}
            color="purple"
            onClick={() => setVerifying(false)}
          >
            Create another
          </Button>
        </Col>
      ) : (
        <Col>
          <H2 textAlign="center" mb={4} bold>
            Create new User
          </H2>
          <LoginForm id="login-form" onSubmit={onSubmit()}>
            <Text {...label("email")} as="label" mb={2} bold>
              Email address:
            </Text>
            <TextInput
              {...email("email")}
              placeholder="Email address..."
              height={[56, 64, 72]}
              fontSize={[15, 16]}
              px={[4, 40]}
              mb={[24, 4]}
              width={[300, 400]}
              maxWidth="100%"
              autoFocus
            />
            <Text {...label("password")} as="label" mb={2} bold>
              Password{" (min chars: 8)"}:
            </Text>
            <TextInput
              {...password("password")}
              placeholder="Password..."
              px={[4, 40]}
              height={[56, 64, 72]}
              fontSize={[15, 16]}
              width={[300, 400]}
              maxWidth="100%"
              mb={[24, 4]}
            />
            <Flex justifyContent="center">
              <Button
                flex="1 1 auto"
                ml={["8px", 16]}
                height={[44, 56]}
                color="purple"
                onClick={onSubmit()}
              >
                <Icon
                  name={loading ? "spinner" : "signup"}
                  stroke="white"
                  mr={2}
                />
                Create User
              </Button>
            </Flex>
            <Text color="red" mt={1} normal>
              {error}
            </Text>
          </LoginForm>
        </Col>
      )}
    </ColCenterV>
  );
};
