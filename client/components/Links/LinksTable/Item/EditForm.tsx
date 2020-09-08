
import React, { FC, useState, useEffect } from "react";
import styled from "styled-components";
import getConfig from "next/config";
import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import differenceInMilliseconds from "date-fns/differenceInMilliseconds";
import ms from "ms";

import { errorMessage } from "../../../../utils";
import { useStoreActions } from "../../../../store";
import { Link as LinkType } from "../../../../store/links";
import { useMessage } from "../../../../hooks";
import { Col, } from "../../../Layout";
import Text from "../../../Text";
import { Checkbox, TextInput } from "../../../Input";
import Icon from "../../../Icon";
import { Button } from "../../../Button";

const { publicRuntimeConfig } = getConfig();

const EditContent = styled(Col)`
  border-bottom: 1px solid hsl(200, 14%, 94%);
  background-color: #FAFAFA;
`;
type Props = {
  link: LinkType;
  showModal: boolean;
  closeModal: Function;
}
interface EditForm {
  target: string;
  address: string;
  description?: string;
  expire_in?: string;
  searchable: Boolean;
}

const EditForm = ({
  link,
  showModal,
  closeModal
}: Props) => {
  const edit = useStoreActions(s => s.links.edit);
  const [editMessage, setEditMessage] = useMessage();
  const [editLoading, setEditLoading] = useState(false);
  const valueExpireIn = () => {
    return link.expire_in 
        ? ms(differenceInMilliseconds(new Date(link.expire_in), new Date()), {long: true})
        : ""
  }
  const [editFormState, { text, label, checkbox: checkboxEdit }] = useFormState<EditForm>(
    {
      target: link.target,
      address: link.address,
      description: link.description,
      expire_in: valueExpireIn()
    },
    { withIds: true }
  );
  const resetValueEditFrom = () => {
    editFormState.setField("target", link.target)
    editFormState.setField("address", link.address)
    editFormState.setField("description", link.description)
    editFormState.setField("expire_in", valueExpireIn());
  }

  const onEdit = async () => {
    if (editLoading) return;
    setEditLoading(true);
    try {
      await edit({ id: link.id, ...editFormState.values });
      closeModal(false);
    } catch (err) {
      setEditMessage(errorMessage(err));
    }
    setEditLoading(false);
  };

  useEffect(() => {
    if (showModal) {
      resetValueEditFrom();
    }
    setEditMessage("");
  }, [showModal]);

  return (
    <>
      {showModal &&
        <EditContent as="tr">
          <Col
            as="td"
            alignItems="flex-start"
            px={[3, 3, 24]}
            py={[3, 3, 24]}
            width={1}
          >
            <Flex alignItems="flex-start" width={1}>
              <Col alignItems="flex-start" mr={3}>
                <Text
                  {...label("target")}
                  as="label"
                  mb={2}
                  fontSize={[14, 15]}
                  bold
                >
                  Target:
                      </Text>
                <Flex as="form">
                  <TextInput
                    {...text("target")}
                    placeholder="Target..."
                    placeholderSize={[13, 14]}
                    fontSize={[14, 15]}
                    height={[40, 44]}
                    width={[1, 250, 420]}
                    pl={[3, 24]}
                    pr={[3, 24]}
                    required
                  />
                </Flex>
              </Col>
              <Col alignItems="flex-start">
                <Text
                  {...label("address")}
                  as="label"
                  mb={2}
                  fontSize={[14, 15]}
                  bold
                >
                  {link.domain || publicRuntimeConfig.DEFAULT_DOMAIN}/
                </Text>
                <Flex as="form">
                  <TextInput
                    {...text("address")}
                    placeholder="Custom address..."
                    placeholderSize={[13, 14]}
                    fontSize={[14, 15]}
                    height={[40, 44]}
                    width={[1, 210, 240]}
                    pl={[3, 24]}
                    pr={[3, 24]}
                    required
                  />
                </Flex>
              </Col>
              <Col alignItems="flex-start"
                style={{ marginTop: "33px" }}>
                <Flex style={{ marginLeft: "20px" }} as="form">
                  <Checkbox {...checkboxEdit('searchable')} label="Searchable" mb={12} />
                </Flex>
              </Col>
            </Flex>
            <Flex alignItems="flex-start" width={1} mt={3}>
              <Col alignItems="flex-start" mr={3}>
                <Text
                  {...label("description")}
                  as="label"
                  mb={2}
                  fontSize={[14, 15]}
                  bold
                >
                  Description:
                </Text>
                <Flex as="form">
                  <TextInput
                    {...text("description")}
                    placeholder="Description..."
                    placeholderSize={[13, 14]}
                    fontSize={[14, 15]}
                    height={[40, 44]}
                    width={[1, 400, 550]}
                    pl={[3, 24]}
                    pr={[3, 24]}
                    required
                  />
                </Flex>
              </Col>
              <Col alignItems="flex-start">
                <Text
                  {...label("expire_in")}
                  as="label"
                  mb={2}
                  fontSize={[14, 15]}
                  bold
                >
                  Expire in :
                </Text>
                <Flex as="form">
                  <TextInput
                    {...text("expire_in")}
                    placeholder="2 minutes/hours/days"
                    placeholderSize={[13, 14]}
                    fontSize={[14, 15]}
                    height={[40, 44]}
                    width={[1, 210, 240]}
                    pl={[3, 24]}
                    pr={[3, 24]}
                    required
                  />
                </Flex>
              </Col>
            </Flex>
            <Button
              color="blue"
              mt={3}
              height={[30, 38]}
              disabled={editLoading}
              onClick={onEdit}
            >
              <Icon
                name={editLoading ? "spinner" : "refresh"}
                stroke="hsl(200, 15%, 70%)"
                mr={2}
              />
              {editLoading ? "Updating..." : "Update"}
            </Button>
            {editMessage.text && (
              <Text mt={3} fontSize={15} color={editMessage.color}>
                {editMessage.text}
              </Text>
            )}
          </Col>
        </EditContent>
      }
    </>
  )
}

export default React.memo(EditForm);
