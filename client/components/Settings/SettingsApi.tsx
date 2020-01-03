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

const ApiKey = styled(Text).attrs({
  mr: 3,
  fontSize: [14, 16],
  fontWeight: 700
})`
  max-width: 100%;
  border-bottom: 2px dotted #999;
`;

const SettingsApi: FC = () => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const apikey = useStoreState(s => s.settings.apikey);
  const generateApiKey = useStoreActions(s => s.settings.generateApiKey);

  const onCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

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
        <Col style={{ position: "relative" }} my={3}>
          {copied && (
            <Text
              color="green"
              fontSize={14}
              style={{ position: "absolute", top: -24 }}
            >
              Copied to clipboard.
            </Text>
          )}
          <Flex
            maxWidth="100%"
            flexDirection={["column", "column", "row"]}
            flexWrap="wrap"
            alignItems={["flex-start", "flex-start", "center"]}
            mb={16}
          >
            <ApiKey>{apikey}</ApiKey>
            <CopyToClipboard text={apikey} onCopy={onCopy}>
              <Button icon="copy" height={36} mt={[3, 3, 0]}>
                Copy
              </Button>
            </CopyToClipboard>
          </Flex>
        </Col>
      )}
      <Button color="purple" onClick={onSubmit} disabled={loading}>
        <Icon name={loading ? "spinner" : "zap"} mr={2} stroke="white" />
        {loading ? "Generating..." : apikey ? "Regenerate" : "Generate"} key
      </Button>
    </Col>
  );
};

export default SettingsApi;
