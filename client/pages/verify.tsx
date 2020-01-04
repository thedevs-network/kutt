import { Flex } from "reflexbox/styled-components";
import React, { useEffect } from "react";
import styled from "styled-components";
import decode from "jwt-decode";
import cookie from "js-cookie";
import Link from "next/link";

import AppWrapper from "../components/AppWrapper";
import { Button } from "../components/Button";
import { useStoreActions } from "../store";
import { Col } from "../components/Layout";
import { TokenPayload } from "../types";
import Icon from "../components/Icon";
import { NextPage } from "next";
import { Colors } from "../consts";
import ALink from "../components/ALink";

interface Props {
  token?: string;
}

const MessageWrapper = styled(Flex).attrs({
  justifyContent: "center",
  alignItems: "center",
  my: 32
})``;

const Message = styled.p`
  font-size: 24px;
  font-weight: 300;

  @media only screen and (max-width: 768px) {
    font-size: 18px;
  }
`;

const Verify: NextPage<Props> = ({ token }) => {
  const addAuth = useStoreActions(s => s.auth.add);

  useEffect(() => {
    if (token) {
      cookie.set("token", token, { expires: 7 });
      const payload: TokenPayload = decode(token);
      addAuth(payload);
    }
  }, []);

  return (
    <AppWrapper>
      {token ? (
        <Col alignItems="center">
          <MessageWrapper>
            <Icon name="check" size={32} mr={3} stroke={Colors.CheckIcon} />
            <Message>Your account has been verified successfully!</Message>
          </MessageWrapper>
          <Link href="/">
            <ALink href="/" forButton>
              <Button>
                <Icon name="arrowLeft" stroke="white" mr={2} />
                Back to homepage
              </Button>
            </ALink>
          </Link>
        </Col>
      ) : (
        <Col alignItems="center">
          <MessageWrapper>
            <Icon name="x" size={32} mr={3} stroke={Colors.TrashIcon} />
            <Message>Invalid verification.</Message>
          </MessageWrapper>
          <Link href="/login">
            <ALink href="/login" forButton>
              <Button color="purple">
                <Icon name="arrowLeft" stroke="white" mr={2} />
                Back to signup
              </Button>
            </ALink>
          </Link>
        </Col>
      )}
    </AppWrapper>
  );
};

Verify.getInitialProps = async ({ req }) => {
  return { token: req && (req as any).token }; // TODO: types bro
};

export default Verify;
