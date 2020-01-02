import React from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";
import SVG from "react-inlinesvg"; // TODO: another solution
import { Colors } from "../consts";
import { ColCenterH } from "./Layout";
import Text, { H3 } from "./Text";

const Title = styled.h3`
  font-size: 28px;
  font-weight: 300;
  margin: 0 0 60px;
  color: #f5f5f5;

  @media only screen and (max-width: 768px) {
    font-size: 24px;
    margin-bottom: 56px;
  }

  @media only screen and (max-width: 448px) {
    font-size: 20px;
    margin-bottom: 40px;
  }
`;

const Button = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 16px;
  padding: 12px 28px;
  font-family: "Nunito", sans-serif;
  background-color: #eee;
  border: 1px solid #aaa;
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
  color: #e0890f;
`;

const ChromeButton = styled(Button)`
  color: #4285f4;
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

const Icon = styled(SVG)`
  svg {
    width: 18px;
    height: 18px;
    margin-right: 16px;
    fill: ${props => props.color || "#333"};

    @media only screen and (max-width: 768px) {
      width: 13px;
      height: 13px;
      margin-right: 10px;
    }
  }
`;

const Extensions = () => (
  <ColCenterH
    width={1}
    flex="0 0 auto"
    flexWrap={["wrap", "wrap", "nowrap"]}
    py={[64, 96]}
    backgroundColor={Colors.ExtensionsBg}
  >
    <H3 fontSize={[26, 28]} mb={5} color="white" light>
      Browser extensions.
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
          <Icon src="/images/googlechrome.svg" color="#4285f4" />
          <span>Download for Chrome</span>
        </ChromeButton>
      </Link>
      <Link
        href="https://addons.mozilla.org/en-US/firefox/addon/kutt/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FirefoxButton>
          <Icon src="/images/mozillafirefox.svg" color="#e0890f" />
          <span>Download for Firefox</span>
        </FirefoxButton>
      </Link>
    </Flex>
  </ColCenterH>
);

export default Extensions;
