import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import React, { FC, useState } from "react";
import styled from "styled-components";
import getConfig from "next/config";

import { useStoreState, useStoreActions } from "../../store";
import { Domain } from "../../store/settings";
import { errorMessage } from "../../utils";
import { useMessage } from "../../hooks";
import Text, { H2, Span } from "../Text";
import {useTheme} from "../../hooks";
import { TextInput } from "../Input";
import { Button } from "../Button";
import { Col } from "../Layout";
import {Table} from "../Table";
import Modal from "../Modal";
import Icon from "../Icon";
import { useTranslation } from 'react-i18next';

const { publicRuntimeConfig } = getConfig();

const Th = styled(Flex).attrs({ as: "th", py: 3, px: 3 })`
  font-size: 15px;
`;
const Td = styled(Flex).attrs({ as: "td", py: 12, px: 3 })`
  font-size: 15px;
`;

const SettingsDomain: FC = () => {
  const theme = useTheme()  
  const { t } = useTranslation("setting");
  const { t : tcommon } = useTranslation();
  const { saveDomain, deleteDomain } = useStoreActions(s => s.settings);
  const [domainToDelete, setDomainToDelete] = useState<Domain>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const domains = useStoreState(s => s.settings.domains);
  const [message, setMessage] = useMessage(2000);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [formState, { label, text }] = useFormState<{
    address: string;
    homepage: string;
  }>(null, { withIds: true });

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveDomain(formState.values);
    } catch (err) {
      setMessage(err?.response?.data?.error || "Couldn't add domain.");
    }
    formState.clear();
    setLoading(false);
  };

  const closeModal = () => {
    setDomainToDelete(null);
    setModal(false);
  };

  const onDelete = async () => {
    setDeleteLoading(true);
    await deleteDomain(domainToDelete.id).catch(err =>
      setMessage(errorMessage(err, "Couldn't delete the domain."))
    );
    setMessage("Domain has been deleted successfully.", "green");
    closeModal();
    setDeleteLoading(false);
  };

  return (
    <Col alignItems="flex-start" maxWidth="100%">
      <H2 mb={4} bold>
        {t('domain.title')}
      </H2>
      <Text mb={3}>
      {t('domain.description1')}
        <b>{publicRuntimeConfig.DEFAULT_DOMAIN}{t('domain.description2')}</b>{t('domain.description3')}
        <b>{t('domain.description4')}</b>
      </Text>
      <Text mb={4}>
      {t('domain.description5')}<b>192.64.116.170</b> {t('domain.description6')}
      </Text>
      {domains.length > 0 && (
        <Table my={3} scrollWidth="550px">
          <thead>
            <tr>
              <Th width={2 / 5}>{t('domain.colDomain')}</Th>
              <Th width={2 / 5}>{t('domain.colHomePage')}</Th>
              <Th width={1 / 5}></Th>
            </tr>
          </thead>
          <tbody>
            {domains.map(d => (
              <tr key={d.address}>
                <Td width={2 / 5}>{d.address}</Td>
                <Td width={2 / 5}>
                  {d.homepage || publicRuntimeConfig.DEFAULT_DOMAIN}
                </Td>
                <Td width={1 / 5} justifyContent="center">
                  <Icon
                    as="button"
                    name="trash"
                    stroke={theme.icon.trash.main}
                    strokeWidth="2.5"
                    backgroundColor={theme.icon.trash.bg}
                    py={0}
                    px={0}
                    size={[23, 24]}
                    p={["4px", "5px"]}
                    onClick={() => {
                      setDomainToDelete(d);
                      setModal(true);
                    }}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
        <Col
          alignItems="flex-start"
          onSubmit={onSubmit}
          width={1}
          as="form"
          my={[3, 4]}
        >
          <Flex width={1} flexDirection={["column", "row"]}>
            <Col mr={[0, 2]} mb={[3, 0]} flex="0 0 auto">
              <Text
                {...label("address")}
                as="label"
                mb={[2, 3]}
                fontSize={[15, 16]}
                bold
              >
              {t('domain.colDomain')}
              </Text>
              <TextInput
                {...text("address")}
                placeholder="example.com"
                maxWidth="240px"
                required
              />
            </Col>
            <Col ml={[0, 2]} flex="0 0 auto">
              <Text
                {...label("homepage")}
                as="label"
                mb={[2, 3]}
                fontSize={[15, 16]}
                bold
              >
                {t('domain.colHomePageOpt')}
              </Text>
              <TextInput
                {...text("homepage")}
                placeholder="Homepage URL"
                flex="1 1 auto"
                maxWidth="240px"
              />
            </Col>
          </Flex>
          <Button type="submit" color="secondary" mt={[24, 3]} disabled={loading}>
            <Icon name={loading ? "spinner" : "plus"} mr={2} stroke={theme.icon.feature.main} />
            {loading ? "Setting..." : "Set domain"}
          </Button>
        </Col>
      <Text color={message.color}>{message.text}</Text>
      <Modal id="delete-custom-domain" show={modal} closeHandler={closeModal}>
        <H2 mb={24} textAlign="center" bold>
        {t('domain.modal.title')}
        </H2>
        <Text textAlign="center">
        {t('domain.modal.description')}
          <Span bold>"{domainToDelete && domainToDelete.address}"</Span>?
        </Text>
        <Flex justifyContent="center" mt={44}>
          {deleteLoading ? (
            <>
              <Icon name="spinner" size={20} stroke={theme.component.spinner} />
            </>
          ) : (
            <>
              <Button color="default" mr={3} onClick={closeModal}>
              {tcommon('button.cancel')}
              </Button>
              <Button color="warning" ml={3} onClick={onDelete}>
                <Icon name="trash" stroke="white" mr={2} />
                {tcommon('button.delete')}
              </Button>
            </>
          )}
        </Flex>
      </Modal>
    </Col>
  );
};

export default SettingsDomain;
