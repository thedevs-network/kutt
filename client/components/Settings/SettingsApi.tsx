import { CopyToClipboard } from "react-copy-to-clipboard";
import { Flex } from "reflexbox/styled-components";
import React, { FC, useState } from "react";
import styled from "styled-components";

import { useStoreState, useStoreActions } from "../../store";
import { Button } from "../Button";
import ALink from "../ALink";
import Icon from "../Icon";
import Text, { H2 } from "../Text";
import { Col } from "../Layout";
import { useCopy } from "../../hooks";
import Animation from "../Animation";
import { Colors } from "../../consts";

const ApiKey = styled(Text).attrs({
  mt: "2px",
  fontSize: [15, 16],
  bold: true
})`
  border-bottom: 1px dotted ${Colors.StatsTotalUnderline};
  cursor: pointer;

  :hover {
    opacity: 0.8;
  }
`;

const SettingsApi: FC = () => {
  const [copied, setCopied] = useCopy();
  const [loading, setLoading] = useState(false);
  const apikey = useStoreState(s => s.settings.apikey);
  const generateApiKey = useStoreActions(s => s.settings.generateApiKey);

  const onSubmit = async () => {
    if (loading) return;
    setLoading(true);
    await generateApiKey();
    setLoading(false);
  };

  return (
    <Col alignItems="flex-start">
      <H2 mb={4} bold>
        API
      </H2>
      <Text mb={4}>
        In additional to this website, you can use the API to create, delete and
        get shortend URLs. If
        {" you're"} not familiar with API, {"don't"} generate the key. DO NOT
        share this key on the client side of your website.{" "}
        <ALink
          href="https://github.com/thedevs-network/kutt#api"
          title="API Docs"
          target="_blank"
        >
          Read API docs.
        </ALink>
      </Text>
      {apikey && (
        <Flex alignItems="center" my={3}>
          {copied ? (
            <Animation offset="10px" duration="0.2s">
              <Icon
                size={[23, 24]}
                py={0}
                px={0}
                mr={2}
                p="3px"
                name="check"
                strokeWidth="3"
                stroke={Colors.CheckIcon}
              />
            </Animation>
          ) : (
            <Animation offset="-10px" duration="0.2s">
              <CopyToClipboard text={apikey} onCopy={setCopied}>
                <Icon
                  as="button"
                  py={0}
                  px={0}
                  mr={2}
                  size={[23, 24]}
                  p={["4px", "5px"]}
                  name="copy"
                  strokeWidth="2.5"
                  stroke={Colors.CopyIcon}
                  backgroundColor={Colors.CopyIconBg}
                />
              </CopyToClipboard>
            </Animation>
          )}
          <CopyToClipboard text={apikey} onCopy={setCopied}>
            <ApiKey>{apikey}</ApiKey>
          </CopyToClipboard>
        </Flex>
      )}
      <Button mt={2} color="purple" onClick={onSubmit} disabled={loading}>
        <Icon name={loading ? "spinner" : "zap"} mr={2} stroke="white" />
        {loading ? "Generating..." : apikey ? "Regenerate" : "Generate"} key
      </Button>
    </Col>
  );
};

export default SettingsApi;
