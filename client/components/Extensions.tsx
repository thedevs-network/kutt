import React from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";
import SVG from "react-inlinesvg"; // TODO: another solution
import {useTheme} from "../hooks";
import { ColCenterH } from "./Layout";
import { H3 } from "./Text";
import { useTranslation } from 'react-i18next';

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 16px;
  padding: 12px 28px;
  font-family: "Nunito", sans-serif;
  background-color: ${({ theme }) => theme.background.default};
  border: 1px solid ${({ theme }) => theme.background.default};

  font-size: 14px;
  font-weight: bold;
  text-decoration: none;
  border-radius: 4px;
  outline: none;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease-out;
  cursor: pointer;

  @media only screen and (max-width: 768px) {
    margin-bottom: 16px;
    padding: 8px 16px;
    font-size: 12px;
  }

  > * {
    text-decoration: none;
  }

  :hover {
    transform: translateY(-2px);
  }
`;

const FirefoxButton = styled(Button)`
  color: ${({ theme }) => theme.icon.firefox.main};
`;

const ChromeButton = styled(Button)`
  color: ${({ theme }) => theme.icon.chrome.main};
`;

const Link = styled.a`
  text-decoration: none;

  :visited,
  :hover,
  :active,
  :focus {
    text-decoration: none;
  }
`;
const Container = styled(ColCenterH)`
  background-color: ${({ theme }) => theme.background.extensions};
`

const Icon = styled(SVG)`
  width: 18px;
  height: 18px;
  margin-right: 16px;
  fill: ${props => props.color || "#333"};

  @media only screen and (max-width: 768px) {
    width: 13px;
    height: 13px;
    margin-right: 10px;
  }
`;

const Extensions = () => {
  const theme = useTheme()   
  const { t } = useTranslation();
  return (
    <Container
      width={1}
      flex="0 0 auto"
      flexWrap={["wrap", "wrap", "nowrap"]}
      py={[64, 96]}
    >
      <H3 fontSize={[26, 28]} mb={5} color={theme.text.extensions} light>
        {t('extensions.title')}
      </H3>
      <Flex
        width={1200}
        maxWidth="100%"
        flex="1 1 auto"
        justifyContent="center"
        flexWrap={["wrap", "wrap", "nowrap"]}
      >
        <Link
          href="https://chrome.google.com/webstore/detail/kutt/pklakpjfiegjacoppcodencchehlfnpd"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ChromeButton>
          <Icon src="/images/googlechrome.svg" color={theme.icon.chrome.main} />
            <span>{t('extensions.btnChrome')}</span>
          </ChromeButton>
        </Link>
        <Link
          href="https://addons.mozilla.org/en-US/firefox/addon/kutt/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FirefoxButton>
          <Icon src="/images/mozillafirefox.svg" color={theme.icon.firefox.main} />
            <span>{t('extensions.btnFirefox')}</span>
          </FirefoxButton>
        </Link>
      </Flex>
    </Container>
  );
}

export default Extensions;
