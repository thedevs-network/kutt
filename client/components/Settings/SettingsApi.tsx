import { CopyToClipboard } from "react-copy-to-clipboard";
import { Flex } from "reflexbox/styled-components";
import React, { FC, useState } from "react";
import styled from "styled-components";

import { useStoreState, useStoreActions } from "../../store";
import { useCopy, useMessage } from "../../hooks";
import { errorMessage } from "../../utils";
import { Colors } from "../../consts";
import Animation from "../Animation";
import { Button } from "../Button";
import Text, { H2 } from "../Text";
import { Col } from "../Layout";
import ALink from "../ALink";
import Icon from "../Icon";
import { useTranslation } from 'react-i18next';

const ApiKey = styled(Text).attrs({
  mt: [0, "2px"],
  fontSize: [15, 16],
  bold: true
})`
  border-bottom: 1px dotted ${Colors.StatsTotalUnderline};
  cursor: pointer;
  word-break: break-word;

  :hover {
    opacity: 0.8;
  }
`;

const SettingsApi: FC = () => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useCopy();
  const [message, setMessage] = useMessage(1500);
  const [loading, setLoading] = useState(false);
  const apikey = useStoreState(s => s.settings.apikey);
  const generateApiKey = useStoreActions(s => s.settings.generateApiKey);

  const onSubmit = async () => {
    if (loading) return;
    setLoading(true);
    await generateApiKey().catch(err => setMessage(errorMessage(err)));
    setLoading(false);
  };

  return (
    <Col alignItems="flex-start" maxWidth="100%">
      <H2 mb={4} bold>
      {t('settings.api.title')}
      </H2>
      <Text mb={4}>
        {t('settings.api.description1')}
        <ALink href="https://docs.kutt.it" title="API Docs" target="_blank">
        {t('settings.api.description2')}
        </ALink>
      </Text>
      {apikey && (
        <Flex alignItems={["flex-start", "center"]} my={3}>
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
      <Button mt={3} color="purple" onClick={onSubmit} disabled={loading}>
        <Icon name={loading ? "spinner" : "zap"} mr={2} stroke="white" />
        {loading ? t('settings.api.btnGenerating') : apikey ? t('settings.api.btnRegenerateKey') : t('settings.api.btnGenerateKey')}
      </Button>
      <Text fontSize={15} mt={3} color={message.color}>
        {message.text}
      </Text>
    </Col>
  );
};

export default SettingsApi;
