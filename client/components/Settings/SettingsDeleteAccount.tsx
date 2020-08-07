import { useFormState } from "react-use-form-state";
import React, { FC, useState } from "react";
import getConfig from "next/config";
import Router from "next/router";
import axios from "axios";
import styled  from "styled-components";

import { getAxiosConfig } from "../../utils";
import { Col, RowCenterV, RowCenterH } from "../Layout";
import Text, { H2, Span } from "../Text";
import { useMessage } from "../../hooks";
import { TextInput } from "../Input";
import { APIv2 } from "../../consts";
import { Button } from "../Button";
import Icon from "../Icon";
import Modal from "../Modal";
import { useTranslation } from 'react-i18next';
import {useTheme} from "../../hooks";

const ModalStyled = styled.div`
  background-color: blue;
`

const { publicRuntimeConfig } = getConfig();

const SettingsDeleteAccount: FC = () => {
  const theme = useTheme()   
  const { t } = useTranslation("setting");
  const { t : tcommon } = useTranslation();
  const [message, setMessage] = useMessage(1500);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [formState, { password, label }] = useFormState<{ accpass: string }>(
    null,
    {
      withIds: true
    }
  );

  const onSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    setModal(true);
  };

  const onDelete = async e => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await axios.post(
        `${APIv2.Users}/delete`,
        { password: formState.values.accpass },
        getAxiosConfig()
      );
      Router.push("/logout");
    } catch (error) {
      setMessage(error.response.data.error);
    }
    setLoading(false);
  };

  return (
    <Col alignItems="flex-start" maxWidth="100%">
      <H2 mb={4} bold>
        {t('account.title')}
      </H2>
      <Text mb={4}>{t('account.description')}{publicRuntimeConfig.SITE_NAME}.</Text>
      <Text
        {...label("password")}
        as="label"
        mb={[2, 3]}
        fontSize={[15, 16]}
        bold
      >
        {t('account.password')}
      </Text>
      <RowCenterV as="form" onSubmit={onSubmit}>
        <TextInput
          {...password("accpass")}
          placeholder={t('account.password')}
          autoComplete="off"
          mr={3}
        />
        <Button color="warning" type="submit" disabled={loading}>
          <Icon name={loading ? "spinner" : "trash"} mr={2} stroke={theme.icon.feature.main} />
          {tcommon('button.delete')}
        </Button>
      </RowCenterV>
      <Modal
        id="delete-account"
        show={modal}
        closeHandler={() => setModal(false)}
      >
        <>
          <H2 mb={24} textAlign="center" bold>
          {t('account.modal.title')}
          </H2>
          <Text textAlign="center">
          {t('account.modal.description1')}<Span bold>{t('account.modal.description2')}</Span> {t('account.modal.description3')}
            <Span bold>{t('account.modal.description4')}</Span>{t('account.modal.description5')}
          </Text>
          <RowCenterH mt={44}>
            {loading ? (
              <>
                <Icon name="spinner" size={20} stroke={theme.component.spinner} />
              </>
            ) : message.text ? (
              <Text fontSize={15} color={message.color}>
                {message.text}
              </Text>
            ) : (
              <>
                <Button color="default" mr={3} onClick={() => setModal(false)}>
                {tcommon('button.cancel')}
                </Button>
                <Button color="warning" ml={3} onClick={onDelete}>
                  <Icon name="trash" stroke={theme.icon.feature.main} mr={2} />
                  {tcommon('button.delete')}
                </Button>
              </>
            )}
          </RowCenterH>
        </>
      </Modal>
    </Col>
  );
};

export default SettingsDeleteAccount;
