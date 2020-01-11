import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import React, { useState } from "react";
import { NextPage } from "next";
import axios from "axios";

import AppWrapper from "../components/AppWrapper";
import { TextInput } from "../components/Input";
import { Button } from "../components/Button";
import Text, { H2 } from "../components/Text";
import { Col } from "../components/Layout";
import Icon from "../components/Icon";

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
    <AppWrapper>
      {!protectedLink ? (
        <H2 my={4} light>
          404 | Link could not be found.
        </H2>
      ) : (
        <Col width={500} maxWidth="97%">
          <H2 my={3} bold>
            Protected link
          </H2>
          <Text mb={4}>Enter the password to be redirected to the link.</Text>
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
            <Button type="submit" height={[40, 44]}>
              {loading && <Icon name={"spinner"} stroke="white" mr={2} />}
              Go
            </Button>
          </Flex>
          <Text fontSize={14} color="red" mt={3} normal>
            {error}
          </Text>
        </Col>
      )}
    </AppWrapper>
  );
};

UrlPasswordPage.getInitialProps = async ({ req }) => {
  return {
    protectedLink: req && (req as any).protectedLink
  };
};

export default UrlPasswordPage;
