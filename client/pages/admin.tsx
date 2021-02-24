import { NextPage } from "next";
import React, { FC, useEffect, useState } from "react";
import AppWrapper from "../components/AppWrapper";
import Text, { H1, H2, Span } from "../components/Text";
import Divider from "../components/Divider";
import { Col, ColCenterV } from "../components/Layout";
import Footer from "../components/Footer";
import { useStoreState } from "../store";
import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import emailValidator from "email-validator";
import styled from "styled-components";
import Router from "next/router";
import axios from "axios";

import { APIv2 } from "../consts";
import { TextInput } from "../components/Input";
import { fadeIn } from "../helpers/animations";
import { Button } from "../components/Button";
import Icon from "../components/Icon";
import { getAxiosConfig } from "../utils";
import Modal from "../components/Modal";
import UsersTable from "../components/UserTable";

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
        <H2 mb={4} bold>
          Users
        </H2>

        <UsersTable />
      </Col>
      <Footer />
    </AppWrapper>
  );
};

export default AdminPage;
