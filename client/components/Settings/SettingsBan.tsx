import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import React, { FC, useState } from "react";
import axios from "axios";

import { Checkbox, TextInput } from "../Input";
import { getAxiosConfig } from "../../utils";
import { useMessage } from "../../hooks";
import { API } from "../../consts";
import { Button } from "../Button";
import Text, { H2 } from "../Text";
import { Col } from "../Layout";
import Icon from "../Icon";

interface BanForm {
  id: string;
  user: boolean;
  domain: boolean;
  host: boolean;
}

const SettingsBan: FC = () => {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useMessage(3000);
  const [formState, { checkbox, text }] = useFormState<BanForm>();

  const onSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setMessage();
    try {
      const { data } = await axios.post(
        API.BAN_LINK,
        formState.values,
        getAxiosConfig()
      );
      setMessage(data.message, "green");
      formState.clear();
    } catch (err) {
      setMessage(err?.response?.data?.error || "Couldn't ban the link.");
    }
    setSubmitting(false);
  };

  return (
    <Col>
      <H2 mb={4} bold>
        Ban link
      </H2>
      <Col as="form" onSubmit={onSubmit} alignItems="flex-start">
        <Flex mb={24} alignItems="center">
          <TextInput
            {...text("id")}
            placeholder="Link ID (e.g. K7b2A)"
            mr={3}
            width={[1, 3 / 5]}
            required
          />
          <Button height={[36, 40]} type="submit" disabled={submitting}>
            <Icon
              name={submitting ? "spinner" : "lock"}
              stroke="white"
              mr={2}
            />
            {submitting ? "Banning..." : "Ban"}
          </Button>
        </Flex>
        <Checkbox
          {...checkbox("user")}
          label="Ban User (and all of their links)"
          mb={12}
        />
        <Checkbox {...checkbox("domain")} label="Ban Domain" mb={12} />
        <Checkbox {...checkbox("host")} label="Ban Host/IP" />
        <Text color={message.color} mt={3}>
          {message.text}
        </Text>
      </Col>
    </Col>
  );
};

export default SettingsBan;
