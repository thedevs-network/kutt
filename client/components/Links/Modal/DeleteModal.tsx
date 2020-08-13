
import React from "react";
import { useTranslation } from 'react-i18next';
import { Flex } from "reflexbox/styled-components";

import { Link as LinkType } from "../../../store/links";
import { removeProtocol } from "../../../utils";
import { useTheme } from "../../../hooks";
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

  const theme = useTheme()
  const { t } = useTranslation();

  return (
    <Modal
      id="delete-custom-domain"
      show={showModal > -1}
      closeHandler={() => closeModal(-1)}
    >
      {link && (
        <>
          <H2 mb={24} textAlign="center" bold>
            {t('linksTable.deleteModal.title')}
          </H2>
          <Text textAlign="center">
            {t('linksTable.deleteModal.description')}
            <Span bold>"{removeProtocol(link.link)}"</Span>?
            </Text>
          <Flex justifyContent="center" mt={44}>
            {loading ? (
              <>
                <Icon name="spinner" size={20}
                  stroke={theme.component.spinner} />

              </>
            ) : message.text ? (
              <Text fontSize={15} color={message.color}>
                {message.text}
              </Text>
            ) : (
                  <>
                    <Button
                      color="default"
                      mr={3}
                      onClick={() => closeModal(-1)}
                    >
                      {t('button.cancel')}
                    </Button>
                    <Button color="warning" ml={3} onClick={onDelete}>
                      <Icon name="trash" stroke="white" mr={2} />
                      {t('button.delete')}
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