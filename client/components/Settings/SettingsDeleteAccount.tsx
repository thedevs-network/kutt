import { useFormState } from "react-use-form-state";
import React, { FC, useState } from "react";
import Router from "next/router";
import axios from "axios";

import { getAxiosConfig } from "../../utils";
import { Col, RowCenterV } from "../Layout";
import Text, { H2, Span } from "../Text";
import { useMessage } from "../../hooks";
import { TextInput } from "../Input";
import { APIv2 } from "../../consts";
import { Button } from "../Button";
import Icon from "../Icon";

const SettingsDeleteAccount: FC = () => {
  const [message, setMessage] = useMessage(1500);
  const [loading, setLoading] = useState(false);
  const [formState, { password, label }] = useFormState(null, {
    withIds: true
  });

  const onSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await axios.post(
        `${APIv2.Users}/delete`,
        formState.values,
        getAxiosConfig()
      );
      Router.push("/logout");
    } catch (error) {
      setMessage(error.response.data.error);
    }
    setLoading(false);
  };

  return (
    <Col alignItems="flex-start" maxWidth="100%">
      <H2 mb={4} bold>
        Delete account
      </H2>
      <Text mb={4}>
        Delete your account from {process.env.SITE_NAME}. All of your data
        including your <Span bold>LINKS</Span> and <Span bold>STATS</Span> will
        be deleted.
      </Text>
      <Text
        {...label("password")}
        as="label"
        mb={[2, 3]}
        fontSize={[15, 16]}
        bold
      >
        Password
      </Text>
      <RowCenterV as="form" onSubmit={onSubmit}>
        <TextInput placeholder="Password..." {...password("password")} mr={3} />
        <Button color="red" type="submit" disabled={loading}>
          <Icon name={loading ? "spinner" : "trash"} mr={2} stroke="white" />
          {loading ? "Deleting..." : "Delete"}
        </Button>
      </RowCenterV>
      <Text fontSize={15} mt={3} color={message.color}>
        {message.text}
      </Text>
    </Col>
  );
};

export default SettingsDeleteAccount;
