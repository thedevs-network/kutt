import { Flex } from "rebass/styled-components";
import getConfig from "next/config";
import React, { FC } from "react";
import Router from "next/router";
import useMedia from "use-media";
import Image from "next/image";

import { DISALLOW_REGISTRATION } from "../consts";
import { useStoreState } from "../store";
import styled from "styled-components";
import { RowCenterV } from "./Layout";
import { Button } from "./Button";
import ALink from "./ALink";

const { publicRuntimeConfig } = getConfig();

const Li = styled(Flex).attrs({ ml: [12, 24, 32] })`
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
    padding: 0;
  }

  @media only screen and (max-width: 488px) {
    a {
      font-size: 18px;
    }
  }

  span {
    margin-right: 10px !important;
  }
`;

const Header: FC = () => {
  const { isAuthenticated } = useStoreState((s) => s.auth);
  const isMobile = useMedia({ maxWidth: 640 });

  const login = !isAuthenticated && (
    <Li>
      <ALink
        href="/login"
        title={!DISALLOW_REGISTRATION ? "login / signup" : "login"}
        forButton
        isNextLink
      >
        <Button height={[32, 40]}>
          {!DISALLOW_REGISTRATION ? "Log in / Sign up" : "Log in"}
        </Button>
      </ALink>
    </Li>
  );
  const logout = isAuthenticated && (
    <Li>
      <ALink href="/logout" title="logout" fontSize={[14, 16]} isNextLink>
        Log out
      </ALink>
    </Li>
  );
  const settings = isAuthenticated && (
    <Li>
      <ALink href="/settings" title="Settings" forButton isNextLink>
        <Button height={[32, 40]}>Settings</Button>
      </ALink>
    </Li>
  );

  return (
    <Flex
      width={1232}
      maxWidth="100%"
      p={[16, "0 32px"]}
      mb={[32, 0]}
      height={["auto", "auto", 102]}
      justifyContent="space-between"
      alignItems={["flex-start", "center"]}
    >
      <Flex
        flexDirection={["column", "row"]}
        alignItems={["flex-start", "stretch"]}
      >
        <LogoImage>
          <ALink
            href="/"
            title="Homepage"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.pathname !== "/") Router.push("/");
            }}
            forButton
            isNextLink
          >
            <Image
              src="/images/logo.svg"
              alt="kutt logo"
              width={18}
              height={24}
            />
            {publicRuntimeConfig.SITE_NAME}
          </ALink>
        </LogoImage>

        {!isMobile && (
          <Flex
            style={{ listStyle: "none" }}
            display={["none", "flex"]}
            alignItems="flex-end"
            as="ul"
            m={0}
            px={0}
            pt={0}
            pb="2px"
          >
            <Li>
              <ALink
                href="//github.com/thedevs-network/kutt"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub"
                fontSize={[14, 16]}
              >
                GitHub
              </ALink>
            </Li>
            <Li>
              <ALink
                href="/report"
                title="Report abuse"
                fontSize={[14, 16]}
                isNextLink
              >
                Report
              </ALink>
            </Li>
          </Flex>
        )}
      </Flex>
      <RowCenterV
        m={0}
        p={0}
        justifyContent="flex-end"
        as="ul"
        style={{ listStyle: "none" }}
      >
        {isMobile && (
          <Li>
            <Flex>
              <ALink
                href="/report"
                title="Report"
                fontSize={[14, 16]}
                isNextLink
              >
                Report
              </ALink>
            </Flex>
          </Li>
        )}
        {logout}
        {settings}
        {login}
      </RowCenterV>
    </Flex>
  );
};

export default Header;
