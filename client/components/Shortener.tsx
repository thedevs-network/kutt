import { CopyToClipboard } from "react-copy-to-clipboard";
import { Flex } from "reflexbox/styled-components";
import React, { useState } from "react";
import styled from "styled-components";
import QRCode from "qrcode.react";

import { useStoreActions, useStoreState } from "../store";
import { Col, RowCenterH, RowCenter } from "./Layout";
import { useFormState } from "react-use-form-state";
import { removeProtocol } from "../utils";
import { Link } from "../store/links";
import { useMessage } from "../hooks";
import TextInput from "./TextInput";
import Animation from "./Animation";
import Checkbox from "./Checkbox";
import { Button } from "./Button";
import Tooltip from "./Tooltip";
import Modal from "./Modal";
import Text from "./Text";
import Icon from "./Icon";

const SubmitIconWrapper = styled.div`
  content: "";
  position: absolute;
  top: 0;
  right: 12px;
  width: 64px;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  :hover svg {
    fill: #673ab7;
  }
  @media only screen and (max-width: 448px) {
    right: 8px;
    width: 40px;
  }
`;

const ShortenedLink = styled(Text)`
  border-bottom: 2px dotted #aaa;
  cursor: pointer;
  transition: all 0.2s ease;

  :hover {
    opacity: 0.5;
  }
`;

interface Form {
  target: string;
  customurl?: string;
  password?: string;
  showAdvanced?: boolean;
}

const Shortener = () => {
  const { isAuthenticated } = useStoreState(s => s.auth);
  const [domain] = useStoreState(s => s.settings.domains);
  const submit = useStoreActions(s => s.links.submit);
  const [link, setLink] = useState<Link | null>(null);
  const [message, setMessage] = useMessage(3000);
  const [loading, setLoading] = useState(false);
  const [qrModal, setQRModal] = useState(false);
  const [copied, setCopied] = useMessage(3000);
  const [formState, { raw, password, text, label }] = useFormState<Form>(null, {
    withIds: true,
    onChange(e, stateValues, nextStateValues) {
      if (stateValues.showAdvanced && !nextStateValues.showAdvanced) {
        formState.clear();
        formState.setField("target", stateValues.target);
      }
    }
  });

  const onSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    setCopied("");
    setLoading(true);
    try {
      const link = await submit(formState.values);
      setLink(link);
      formState.clear();
    } catch (err) {
      setMessage(
        err?.response?.data?.error || "Couldn't create the short link."
      );
    }
    setLoading(false);
  };

  const title = !link && (
    <Text as="h1" fontWeight={300}>
      Kutt your links{" "}
      <Text
        as="span"
        fontWeight={300}
        style={{ borderBottom: "2px dotted #999" }}
      >
        shorter
      </Text>
      .
    </Text>
  );

  const onCopy = () => setCopied("Copied to clipboard.", "green");

  const result = link && (
    <Animation
      as={RowCenter}
      offset="-20px"
      duration="0.4s"
      style={{ position: "relative" }}
    >
      <CopyToClipboard text={link.shortLink} onCopy={onCopy}>
        <ShortenedLink as="h1" fontWeight={300} mr={3} mb={1} pb="2px">
          {removeProtocol(link.shortLink)}
        </ShortenedLink>
      </CopyToClipboard>
      <CopyToClipboard text={link.shortLink} onCopy={onCopy}>
        <Button>
          <Icon name="clipboard" stroke="white" mr={2} />
          Copy
        </Button>
      </CopyToClipboard>
      {copied && (
        <Animation
          as={Text}
          offset="10px"
          color={copied.color}
          fontSize={15}
          style={{ position: "absolute", left: 0, top: -24 }}
        >
          {copied.text}
        </Animation>
      )}
    </Animation>
  );

  return (
    <Col width={800} maxWidth="98%" flex="0 0 auto" mt={4}>
      <RowCenterH mb={40}>
        {title}
        {result}
      </RowCenterH>
      <Flex
        as="form"
        id="shortenerform"
        width={800}
        maxWidth="100%"
        alignItems="center"
        justifyContent="center"
        style={{ position: "relative" }}
        onSubmit={onSubmit}
      >
        <TextInput
          {...text("target")}
          placeholder="Paste your long URL"
          placeholderSize={[16, 18]}
          fontSize={[20, 22]}
          width={1}
          height={[72]}
          autoFocus
        />
        <SubmitIconWrapper onClick={onSubmit}>
          <Icon
            name={loading ? "spinner" : "send"}
            size={28}
            fill={loading ? "none" : "#aaa"}
            stroke={loading ? "#888" : "none"}
            mb={1}
            mr={1}
          />
        </SubmitIconWrapper>
      </Flex>
      {message.text && (
        <Text color={message.color} mt={24} mb={1} textAlign="center">
          {message.text}
        </Text>
      )}
      <Checkbox
        {...raw({
          name: "showAdvanced",
          onChange: e => {
            if (!isAuthenticated) {
              setMessage(
                "You need to log in or sign up to use advanced options."
              );
              return false;
            }
            return !formState.values.showAdvanced;
          }
        })}
        checked={formState.values.showAdvanced}
        label="Show advanced options"
        mt={24}
      />
      {formState.values.showAdvanced && (
        <Flex mt={4}>
          <Col>
            <Text
              as="label"
              {...label("customurl")}
              fontWeight={700}
              fontSize={15}
              mb={2}
            >
              {(domain || {}).customDomain ||
                (typeof window !== "undefined" && window.location.hostname)}
              /
            </Text>
            <TextInput
              {...text("customurl")}
              placeholder="Custom address"
              pl={24}
              pr={24}
              placeholderSize={[13, 14, 14, 14]}
              fontSize={[14, 15]}
              height={48}
              width={240}
            />
          </Col>
          <Col ml={4}>
            <Text
              as="label"
              {...label("password")}
              fontWeight={700}
              fontSize={15}
              mb={2}
            >
              Password:
            </Text>
            <TextInput
              {...password("password")}
              placeholder="Password"
              pl={24}
              pr={24}
              placeholderSize={[13, 14, 14, 14]}
              fontSize={[14, 15]}
              height={48}
              width={240}
            />
          </Col>
        </Flex>
      )}
    </Col>
  );
};

export default Shortener;
