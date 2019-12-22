import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import React, { FC, useState } from "react";
import axios from "axios";

import { getAxiosConfig } from "../../utils";
import { useMessage } from "../../hooks";
import TextInput from "../TextInput";
import { API } from "../../consts";
import Button from "../Button";
import Text from "../Text";

const SettingsPassword: FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useMessage();
  const [formState, { password }] = useFormState<{ password: string }>();

  const onSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    if (!formState.validity.password) {
      return setMessage(formState.errors.password);
    }
    setLoading(true);
    setMessage();
    try {
      const res = await axios.post(
        API.CHANGE_PASSWORD,
        formState.values,
        getAxiosConfig()
      );
      formState.clear();
      setMessage(res.data.message, "green");
    } catch (err) {
      setMessage(err?.response?.data?.error || "Couldn't update the password.");
    }
    setLoading(false);
  };

  return (
    <Flex flexDirection="column" alignItems="flex-start">
      <Text as="h2" fontWeight={700} mb={4}>
        Change password
      </Text>
      <Text mb={4}>Enter a new password to change your current password.</Text>
      <Flex as="form" onSubmit={onSubmit}>
        <TextInput
          {...password({
            name: "password",
            validate: value => {
              const val = value.trim();
              if (!val || val.length < 8) {
                return "Password must be at least 8 chars.";
              }
            }
          })}
          placeholder="New password"
          height={44}
          width={[1, 2 / 3]}
          pl={24}
          pr={24}
          mr={3}
          required
        />
        <Button type="submit" icon={loading ? "loader" : "refresh"}>
          {loading ? "Updating..." : "Update"}
        </Button>
      </Flex>
      <Text color={message.color} mt={3} fontSize={14}>
        {message.text}
      </Text>
    </Flex>
  );
};

export default SettingsPassword;
