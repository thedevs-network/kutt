import React, { FC, useState } from "react";
import styled from "styled-components";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { Flex } from "reflexbox/styled-components";

import Button from "../Button";
import Text from "../Text";
import ALink from "../ALink";
import { useStoreState, useStoreActions } from "../../store";

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
    setLoading(true);
    await generateApiKey();
    setLoading(false);
  };

  return (
    <Flex flexDirection="column" alignItems="flex-start">
      <Text as="h2" fontWeight={700} mb={4}>
        API
      </Text>
      <Text as="p" mb={4}>
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
        <Flex flexDirection="column" style={{ position: "relative" }} my={3}>
          {copied && (
            <Text
              as="p"
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
        </Flex>
      )}
      <Button
        color="purple"
        icon={loading ? "loader" : "zap"}
        onClick={onSubmit}
      >
        {loading ? "Generating..." : apikey ? "Regenerate" : "Generate"} key
      </Button>
    </Flex>
  );
};

export default SettingsApi;
