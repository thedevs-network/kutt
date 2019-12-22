import React, { useState } from "react";
import { NextPage } from "next";
import styled from "styled-components";
import axios from "axios";
import { Flex } from "reflexbox/styled-components";
import { useFormState } from "react-use-form-state";

import BodyWrapper from "../components/BodyWrapper";
import TextInput from "../components/TextInput";
import Button from "../components/Button";
import Text from "../components/Text";

interface Props {
  protectedLink?: string;
}

const UrlPasswordPage: NextPage<Props> = ({ protectedLink }) => {
  const [loading, setLoading] = useState(false);
  const [formState, { password }] = useFormState<{ password: string }>();
  const [error, setError] = useState<string>();

  const onSubmit = async e => {
    e.preventDefault();
    const { password } = formState.values;

    if (!password) {
      return setError("Password must not be empty.");
    }

    setError("");
    setLoading(true);
    // TODO: better api calls
    try {
      const { data } = await axios.post("/api/url/requesturl", {
        id: protectedLink,
        password
      });
      window.location.replace(data.target);
    } catch ({ response }) {
      setError(response.data.error);
    }
    setLoading(false);
  };

  return (
    <BodyWrapper>
      {!protectedLink ? (
        <Text as="h2" my={4} fontWeight={300}>
          404 | Link could not be found.
        </Text>
      ) : (
        <Flex width={500} maxWidth="97%" flexDirection="column">
          <Text as="h2" fontWeight={700} my={3}>
            Protected link
          </Text>
          <Text as="p" mb={4}>
            Enter the password to be redirected to the link.
          </Text>
          <Flex
            as="form"
            alignItems="center"
            onSubmit={onSubmit}
            style={{ position: "relative" }}
          >
            <TextInput
              {...password("password")}
              placeholder="Password"
              height={[44, 54]}
              width={[1, 1 / 2]}
              mr={3}
              autoFocus
              required
            />
            <Button
              type="submit"
              icon={loading ? "loader" : ""}
              height={[40, 44]}
            >
              Go
            </Button>
          </Flex>
          <Text fontSize={14} color="red" fontWeight={400} mt={3}>
            {error}
          </Text>
        </Flex>
      )}
    </BodyWrapper>
  );
};

UrlPasswordPage.getInitialProps = async ({ req }) => {
  return {
    protectedLink: req && (req as any).protectedLink
  };
};

export default UrlPasswordPage;
