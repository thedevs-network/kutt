import React, { FC, useState } from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

import { useStoreState, useStoreActions } from "../../store";
import { useFormState } from "react-use-form-state";
import { useMessage } from "../../hooks";
import TextInput from "../TextInput";
import Button from "../Button";
import Text from "../Text";

// TODO: types
interface Props {
  settings: {
    customDomain: string;
    domainInput: boolean;
    homepage: string;
  };
  handleCustomDomain: any;
  loading: boolean;
  showDomainInput: any;
  showModal: any;
}

const ButtonWrapper = styled(Flex).attrs({
  justifyContent: ["column", "column", "row"],
  alignItems: ["flex-start", "flex-start", "center"],
  my: 32
})`
  display: flex;

  button {
    margin-right: 16px;
  }

  @media only screen and (max-width: 768px) {
    > * {
      margin: 8px 0;
    }
  }
`;

const Domain = styled.h4`
  margin: 0 16px 0 0;
  font-size: 20px;
  font-weight: bold;

  span {
    border-bottom: 2px dotted #999;
  }
`;

const Homepage = styled.h6`
  margin: 0 16px 0 0;
  font-size: 14px;
  font-weight: 300;

  span {
    border-bottom: 2px dotted #999;
  }
`;

const SettingsDomain: FC<Props> = ({ showDomainInput, showModal }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useMessage(2000);
  const domains = useStoreState(s => s.settings.domains);
  const { saveDomain } = useStoreActions(s => s.settings);
  const [formState, { text }] = useFormState<{
    customDomain: string;
    homepage: string;
  }>();

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveDomain(formState.values);
    } catch (err) {
      setMessage(err?.response?.data?.error || "Couldn't add domain.");
    }
    setLoading(false);
  };

  return (
    <Flex alignItems="flex-start" flexDirection="column">
      <Text as="h2" fontWeight={700} mb={4}>
        Custom domain
      </Text>
      <Text as="p" mb={3}>
        You can set a custom domain for your short URLs, so instead of{" "}
        <b>kutt.it/shorturl</b> you can have <b>example.com/shorturl.</b>
      </Text>
      <Text mb={4}>
        Point your domain A record to <b>192.64.116.170</b> then add the domain
        via form below:
      </Text>
      {domains.length ? (
        domains.map(d => (
          <Flex key={d.customDomain}>
            <Flex alignItems="center">
              <Domain>
                <span>{d.customDomain}</span>
              </Domain>
              <Homepage>
                (Homepage redirects to{" "}
                <span>{d.homepage || window.location.hostname}</span>)
              </Homepage>
            </Flex>
            <ButtonWrapper>
              <Button icon="edit" onClick={showDomainInput}>
                Change
              </Button>
              <Button color="gray" icon="x" onClick={showModal}>
                Delete
              </Button>
            </ButtonWrapper>
          </Flex>
        ))
      ) : (
        <Flex
          alignItems="flex-start"
          flexDirection="column"
          onSubmit={onSubmit}
          width={1}
          as="form"
          my={4}
        >
          <Flex width={1}>
            <Flex flexDirection="column" mr={2} flex="1 1 auto">
              <Text as="label" htmlFor="customdomain" fontWeight={700} mb={3}>
                Domain
              </Text>
              <TextInput
                {...text("customDomain")}
                placeholder="example.com"
                height={44}
                pl={24}
                pr={24}
                required
              />
            </Flex>
            <Flex flexDirection="column" ml={2} flex="1 1 auto">
              <Text as="label" htmlFor="customdomain" fontWeight={700} mb={3}>
                Homepage (optional)
              </Text>
              <TextInput
                {...text("homepage")}
                type="text"
                placeholder="Homepage URL"
                flex="1 1 auto"
                height={44}
                pl={24}
                pr={24}
              />
            </Flex>
          </Flex>
          <Button
            type="submit"
            color="purple"
            icon={loading ? "loader" : ""}
            mt={3}
          >
            Set domain
          </Button>
        </Flex>
      )}
      <Text color={message.color}>{message.text}</Text>
    </Flex>
  );
};

export default SettingsDomain;
