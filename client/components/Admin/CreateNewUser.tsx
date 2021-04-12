import React, { FC, useEffect, useState } from "react";
import { Flex } from "reflexbox/styled-components";
import Text, { H2 } from "../Text";
import { Button } from "../Button";
import Modal from "../Modal";
import styled from "styled-components";
import { fadeIn } from "../../helpers/animations";
import { useStoreState } from "../../store";
import { useFormState } from "react-use-form-state";
import Router from "next/router";
import emailValidator from "email-validator";
import axios from "axios";
import { APIv2 } from "../../consts";
import { getAxiosConfig } from "../../utils";
import { Col, ColCenterV } from "../Layout";
import Icon from "../Icon";
import { TextInput } from "../Input";

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

interface CreateNewUserButtonProps {
  reload: () => void;
}

const CreateNewUserButton: FC<CreateNewUserButtonProps> = ({ reload }) => {
  const [showCreateUser, setShowCreateUser] = useState(false);

  const onClose = () => {
    reload();
    setShowCreateUser(false);
  };

  return (
    <>
      <Button
        height={[32, 40]}
        color="purple"
        onClick={() => setShowCreateUser(true)}
      >
        <Icon name={"plus"} stroke="white" mr={2} />
        New User
      </Button>
      <Modal id="create-new-user" show={showCreateUser} closeHandler={onClose}>
        <CreateNewUser close={onClose} />
      </Modal>
    </>
  );
};

interface CreateNewUserProps {
  close: () => void;
}

const CreateNewUser: FC<CreateNewUserProps> = ({ close }) => {
  const { isAuthenticated, isAdmin } = useStoreState(s => s.auth);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formState, { email, password, label }] = useFormState<{
    email: string;
    password: string;
  }>(null, { withIds: true });

  const reset = () => {
    formState.clear();
    setVerifying(false);
  };

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
          <Flex justifyContent="space-equally" mt={4}>
            <Button
              flex="1 1 auto"
              ml={["8px", 16]}
              height={[44, 56]}
              color="gray"
              onClick={() => close()}
            >
              Close
            </Button>
            <Button
              flex="1 1 auto"
              ml={["8px", 16]}
              height={[44, 56]}
              color="purple"
              onClick={reset}
            >
              <Icon name={"plus"} stroke="white" mr={2} />
              Create another
            </Button>
          </Flex>
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

export default CreateNewUserButton;
