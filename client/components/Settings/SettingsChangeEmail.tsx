import { useFormState } from "react-use-form-state";
import React, { FC, useState } from "react";
import { Flex } from "reflexbox";
import axios from "axios";

import { getAxiosConfig } from "../../utils";
import { useMessage } from "../../hooks";
import { APIv2 } from "../../consts";
import { TextInput } from "../Input";
import Text, { H2 } from "../Text";
import { Button } from "../Button";
import { Col } from "../Layout";
import Icon from "../Icon";

const SettingsChangeEmail: FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useMessage(5000);
  const [formState, { password, email, label }] = useFormState<{
    changeemailpass: string;
    changeemailaddress: string;
  }>(null, {
    withIds: true
  });

  const onSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await axios.post(
        APIv2.AuthChangeEmail,
        {
          password: formState.values.changeemailpass,
          email: formState.values.changeemailaddress
        },
        getAxiosConfig()
      );
      setMessage(res.data.message, "green");
    } catch (error) {
      setMessage(error?.response?.data?.error || "Couldn't send email.");
    }
    setLoading(false);
  };

  return (
    <Col alignItems="flex-start" maxWidth="100%">
      <H2 mb={4} bold>
        Change email address
      </H2>
      <Col alignItems="flex-start" onSubmit={onSubmit} width={1} as="form">
        <Flex width={1} flexDirection={["column", "row"]}>
          <Col mr={[0, 2]} mb={[3, 0]} flex="0 0 auto">
            <Text
              {...label("changeemailpass")}
              as="label"
              mb={[2, 3]}
              fontSize={[15, 16]}
              bold
            >
              Password:
            </Text>
            <TextInput
              {...password("changeemailpass")}
              placeholder="Password..."
              maxWidth="240px"
              required
            />
          </Col>
          <Col ml={[0, 2]} flex="0 0 auto">
            <Text
              {...label("changeemailaddress")}
              as="label"
              mb={[2, 3]}
              fontSize={[15, 16]}
              bold
            >
              New email address:
            </Text>
            <TextInput
              {...email("changeemailaddress")}
              placeholder="john@example.com"
              flex="1 1 auto"
              maxWidth="240px"
            />
          </Col>
        </Flex>
        <Button type="submit" color="blue" mt={[24, 3]} disabled={loading}>
          <Icon name={loading ? "spinner" : "refresh"} mr={2} stroke="white" />
          {loading ? "Sending..." : "Update"}
        </Button>
      </Col>
      <Text fontSize={15} color={message.color} mt={3}>
        {message.text}
      </Text>
    </Col>
  );
};

export default SettingsChangeEmail;
