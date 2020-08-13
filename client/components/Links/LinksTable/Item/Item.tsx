import formatDistanceToNow from "date-fns/formatDistanceToNow";
import { CopyToClipboard } from "react-copy-to-clipboard";
import React, { useState } from "react";
import { Flex } from "reflexbox/styled-components";
import styled from "styled-components";
import { ifProp } from "styled-tools";
import getConfig from "next/config";

import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import ms from "ms";

import { useTheme } from "../../../../hooks";
import { removeProtocol, withComma } from "../../../../utils";
import { useStoreState } from "../../../../store";
import { Link as LinkType } from "../../../../store/links";
import { Col } from "../../../Layout";
import Text from "../../../Text";
import Animation from "../../../Animation";
import ALink from "../../../ALink";
import Icon from "../../../Icon";
import Action from "./Action"
import Actions from "./Actions"
import EditForm from "./EditForm"
import {Tr, Th, Td} from "../../../Table";

const ogLinkFlex = { flexGrow: [1, 3, 7], flexShrink: [1, 3, 7] };
const createdFlex = { flexGrow: [1, 1, 2.5], flexShrink: [1, 1, 2.5] };
const shortLinkFlex = { flexGrow: [1, 1, 3], flexShrink: [1, 1, 3] };
const viewsFlex = {
  flexGrow: [0.5, 0.5, 1],
  flexShrink: [0.5, 0.5, 1],
  justifyContent: "flex-end"
};


type Props = {
  index: number;
  link: LinkType;
  setDeleteModal: (number) => void;
}


const Item = ({
  index,
  link,
  setDeleteModal
}: Props) => {
  const theme = useTheme()
  const [copied, setCopied] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const onCopy = () => {
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };


  return (
    <>
      <Tr key={link.id}>
        <Td {...ogLinkFlex} withFade>
          <Col alignItems="flex-start">
            <ALink href={link.target}>{link.target}</ALink>
            {link.description && (
              <Text fontSize={[13, 14]} color={theme.text.placeholder}>
                {link.description}
              </Text>
            )}
          </Col>
        </Td>
        <Td {...createdFlex} flexDirection="column" alignItems="flex-start">
          <Text>{formatDistanceToNow(new Date(link.created_at))} ago</Text>
          {link.expire_in && (
            <Text fontSize={[13, 14]} color="#888">
              Expires in{" "}
              {ms(
                differenceInMilliseconds(new Date(link.expire_in), new Date()),
                {
                  long: true
                }
              )}
            </Text>
          )}
        </Td>
        <Td {...shortLinkFlex} withFade>
          {copied ? (
            <Animation
              minWidth={32}
              offset="10px"
              duration="0.2s"
              alignItems="center"
            >
              <Icon
                size={[23, 24]}
                py={0}
                px={0}
                mr={2}
                p="3px"
                name="check"
                strokeWidth="3"
                stroke={theme.icon.check.main}
              />
            </Animation>
          ) : (
              <Animation minWidth={32} offset="-10px" duration="0.2s">
                <CopyToClipboard text={link.link} onCopy={onCopy}>
                  <Action
                    name="copy"
                    strokeWidth="2.5"
                    stroke={theme.icon.copy.main}
                    backgroundColor={theme.icon.copy.bg}

                  />
                </CopyToClipboard>
              </Animation>
            )}
          <ALink href={link.link}>{removeProtocol(link.link)}</ALink>
        </Td>
        <Td {...viewsFlex}>{withComma(link.visit_count)}</Td>
        <Actions
          link={link}
          setDeleteModal={setDeleteModal}
          index={index}
          setShowEdit={setShowEdit}
        />
      </Tr>
      <EditForm link={link} showModal={showEdit} closeModal={setShowEdit} />
    </>
  );
};

export default Item