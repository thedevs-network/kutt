import { Flex } from "reflexbox/styled-components";
import React, { FC } from "react";
import Router from "next/router";
import useMedia from "use-media";
import Link from "next/link";

import { useStoreState } from "../store";
import styled from "styled-components";
import { RowCenterV } from "./Layout";
import { Button } from "./Button";
import ALink from "./ALink";
import { Select } from "./Input";
import { useTranslation } from 'react-i18next';

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
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useStoreState(s => s.auth);
  const isMobile = useMedia({ maxWidth: 640 });

  const login = !isAuthenticated && (
    <Li>
      <Link href="/login">
        <ALink href="/login" title="login / signup" forButton>
          <Button height={[32, 40]}>{t('button.login')+" / "+t('button.signUp')}</Button>
        </ALink>
      </Link>
    </Li>
  );
  const logout = isAuthenticated && (
    <Li>
      <Link href="/logout">
        <ALink href="/logout" title="logout" fontSize={[14, 16]}>
        {t('button.logout')}
        </ALink>
      </Link>
    </Li>
  );
  const settings = isAuthenticated && (
    <Li>
      <Link href="/settings">
        <ALink href="/settings" title="Settings" forButton>
          <Button height={[32, 40]}>{t('header.settings')}</Button>
        </ALink>
      </Link>
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
          <a
            href="/"
            title="Homepage"
            onClick={e => {
              e.preventDefault();
              if (window.location.pathname !== "/") Router.push("/");
            }}
          >
            <img src="/images/logo.svg" alt="" />
            {process.env.SITE_NAME}
          </a>
        </LogoImage>
        {!isMobile && (
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
                fontSize={[14, 16]}
              >
                {t('header.gitHub')}
              </ALink>
            </Li>
            <Li>
              <Link href="/report">
                <ALink href="/report" title="Report abuse" fontSize={[14, 16]}>
                {t('header.report')}
                </ALink>
              </Link>
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
        <Li>
          <Flex display={["flex", "none"]}>
            <Link href="/report">
              <ALink href="/report" title="Report" fontSize={[14, 16]}>
              {t('header.report')}
              </ALink>
            </Link>
          </Flex>
        </Li>
        {i18n.languages.length > 1 &&
         <Select
            pl={[3, 24]}
            pr={[3, 24]}
            fontSize={[14, 15]}
            height={[32, 37]}
            width={[110, 150]}
            onChange= {(event) =>i18n.changeLanguage(event.target.value)}
            options={
              i18n.languages.map(d => ({
                key: t(`language.${d}`)+"",
                value: d
              }))
            }
            value={i18n.language}
          /> 
        }
        {logout}
        {settings}
        {login}
      </RowCenterV>
    </Flex>
  );
};

export default Header;
