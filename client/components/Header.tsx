import { Flex } from "reflexbox/styled-components";
import React, { FC } from "react";
import Router from "next/router";
import Link from "next/link";

import { useStoreState } from "../store";
import styled from "styled-components";
import { RowCenterV } from "./Layout";
import { Button } from "./Button";
import ALink from "./ALink";

const Li = styled(Flex).attrs({ ml: [16, 32] })`
  a {
    color: inherit;

    :hover {
      color: #2196f3;
    }
  }
`;

const LogoImage = styled.div`
  & > a {
    position: relative;
    display: flex;
    align-items: center;
    margin: 0 8px 0 0;
    font-size: 22px;
    font-weight: bold;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s ease-out;
  }

  @media only screen and (max-width: 488px) {
    a {
      font-size: 18px;
    }
  }

  img {
    width: 18px;
    margin-right: 11px;
  }
`;

const Header: FC = () => {
  const { isAuthenticated } = useStoreState(s => s.auth);

  const login = !isAuthenticated && (
    <Li>
      <Link href="/login">
        <ALink href="/login" title="login / signup" forButton>
          <Button>Login / Sign up</Button>
        </ALink>
      </Link>
    </Li>
  );
  const logout = isAuthenticated && (
    <Li>
      <Link href="/logout">
        <ALink href="/logout" title="logout">
          Log out
        </ALink>
      </Link>
    </Li>
  );
  const settings = isAuthenticated && (
    <Li>
      <Link href="/settings">
        <ALink href="/settings" title="Settings" forButton>
          <Button>Settings</Button>
        </ALink>
      </Link>
    </Li>
  );

  return (
    <Flex
      width={1232}
      maxWidth="100%"
      p={[16, 16, "0 32px"]}
      mb={[32, 32, 0]}
      height={["auto", "auto", 102]}
      justifyContent="space-between"
      alignItems={["flex-start", "flex-start", "center"]}
    >
      <Flex
        flexDirection={["column", "column", "row"]}
        alignItems={["flex-start", "flex-start", "stretch"]}
      >
        <LogoImage>
          <a
            href="/"
            title="Homepage"
            onClick={e => {
              e.preventDefault();
              if (window.location.pathname !== "/") Router.push("/");
            }}
          >
            <img src="/images/logo.svg" alt="" />
            Kutt.it
          </a>
        </LogoImage>
        <Flex
          style={{ listStyle: "none" }}
          display={["none", "flex"]}
          alignItems="flex-end"
          as="ul"
          mb="3px"
          m={0}
          p={0}
        >
          <Li>
            <ALink
              href="//github.com/thedevs-network/kutt"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
            >
              GitHub
            </ALink>
          </Li>
          <Li>
            <Link href="/report">
              <ALink href="/report" title="Report abuse">
                Report
              </ALink>
            </Link>
          </Li>
        </Flex>
      </Flex>
      <RowCenterV
        m={0}
        p={0}
        justifyContent="flex-end"
        as="ul"
        style={{ listStyle: "none" }}
      >
        <Li>
          <Flex display={["flex", "none"]}>
            <Link href="/report">
              <ALink href="/report" title="Report">
                Report
              </ALink>
            </Link>
          </Flex>
        </Li>
        {logout}
        {settings}
        {login}
      </RowCenterV>
    </Flex>
  );
};

export default Header;
