
import React from "react";
import { Flex } from "reflexbox/styled-components";

import { Link as LinkType } from "../../../store/links";
import { removeProtocol } from "../../../utils";
import Modal from "../../Modal";
import Text, { H2, Span } from "../../Text";
import Icon from "../../Icon";
import { Button } from "../../Button";

type Props = {
  link: LinkType;
  showModal: number;
  closeModal: Function;
  loading: Boolean;
  message: { text: string, color: string };
  onDelete: Function;
}
const DeleteLink = ({
  link,
  showModal,
  closeModal,
  loading,
  message,
  onDelete
}: Props) => {

  return (
    <Modal
      id="delete-custom-domain"
      show={showModal > -1}
      closeHandler={() => closeModal(-1)}
    >
      {link && (
        <>
          <H2 mb={24} textAlign="center" bold>
          Delete link?
          </H2>
          <Text textAlign="center">
          Are you sure do you want to delete the link
            <Span bold>"{removeProtocol(link.link)}"</Span>?
            </Text>
          <Flex justifyContent="center" mt={44}>
            {loading ? (
              <>
                <Icon name="spinner" size={20}
                  stroke="hsl(200, 15%, 70%)" />

              </>
            ) : message.text ? (
              <Text fontSize={15} color={message.color}>
                {message.text}
              </Text>
            ) : (
                  <>
                    <Button
                      color="gray"
                      mr={3}
                      onClick={() => closeModal(-1)}
                    >
                      Cancel
                    </Button>
                    <Button color="red" ml={3} onClick={onDelete}>
                      <Icon name="trash" stroke="white" mr={2} />
                      Delete
                    </Button>
                  </>
                )}
          </Flex>
        </>
      )}
    </Modal>
  )
}
export default DeleteLink;