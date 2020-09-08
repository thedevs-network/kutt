
import React, { useState } from "react";
import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";

import { Link as LinkType } from "../../../store/links";
import { useStoreActions } from "../../../store";
import { removeProtocol, errorMessage } from "../../../utils";
import { useMessage } from "../../../hooks";
import Modal from "../../Modal";
import { RowCenter } from "../../Layout";
import Text, { H2, Span } from "../../Text";
import { Checkbox } from "../../Input";
import Icon from "../../Icon";
import { Button } from "../../Button";

interface BanForm {
  host: boolean;
  user: boolean;
  userLinks: boolean;
  domain: boolean;
}

type Props = {
  link: LinkType;
  showModal: boolean;
  closeModal: Function;
}

const BanLink = ({
  link,
  showModal,
  closeModal
}: Props) => {
  const ban = useStoreActions(s => s.links.ban);
  const [banFormState, { checkbox }] = useFormState<BanForm>();
  const [banLoading, setBanLoading] = useState(false);
  const [banMessage, setBanMessage] = useMessage();


  const onBan = async () => {
    setBanLoading(true);
    try {
      const res = await ban({ id: link.id, ...banFormState.values });
      setBanMessage(res.message, "green");
      setTimeout(() => {
        closeModal(false)
        // setBanModal(false);
      }, 2000);
    } catch (err) {
      setBanMessage(errorMessage(err));
    }
    setBanLoading(false);
  };
  return (
    <Modal
      id="table-ban-modal"
      show={showModal}
      closeHandler={() => closeModal(false)}
    >
      <>
        <H2 mb={24} textAlign="center" bold>
        Ban link?
        </H2>
        <Text mb={24} textAlign="center">
        Are you sure do you want to ban the link
          <Span bold>"{removeProtocol(link.link)}"</Span>?
          </Text>
        <RowCenter>
          <Checkbox {...checkbox("user")} label="User" mb={12} />
          <Checkbox {...checkbox("userLinks")} label="User links" mb={12} />
          <Checkbox {...checkbox("host")} label="Host" mb={12} />
          <Checkbox {...checkbox("domain")} label="Domain" mb={12} />
        </RowCenter>
        <Flex justifyContent="center" mt={4}>
          {banLoading ? (
            <Icon name="spinner" size={20}
              stroke="hsl(200, 15%, 70%)" />
          ) : banMessage.text ? (
            <Text fontSize={15} color={banMessage.color}>
              {banMessage.text}
            </Text>
          ) : (
                <>
                  <Button color="gray" mr={3} onClick={() => closeModal(false)}>
                    Cancel
                  </Button>
                  <Button color="red" ml={3} onClick={onBan}>
                    <Icon name="stop" stroke="white" mr={2} />
                    Ban
                  </Button>
                </>
              )}
        </Flex>
      </>
    </Modal>
  )
}
export default BanLink;