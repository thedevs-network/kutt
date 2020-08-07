import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import React, { FC, useState } from "react";
import axios from "axios";

import { getAxiosConfig } from "../../utils";
import { useMessage } from "../../hooks";
import { TextInput } from "../Input";
import { APIv2 } from "../../consts";
import { Button } from "../Button";
import Text, { H2 } from "../Text";
import { Col } from "../Layout";
import Icon from "../Icon";
import { useTranslation } from 'react-i18next';
import {useTheme} from "../../hooks";

const SettingsPassword: FC = () => {
  const theme = useTheme()   
  const { t } = useTranslation("setting");
  const { t : tcommon } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useMessage(2000);
  const [formState, { password, label }] = useFormState<{ password: string }>(
    null,
    { withIds: true }
  );

  const onSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    if (!formState.validity.password) {
      return setMessage(formState.errors.password);
    }
    setLoading(true);
    setMessage();
    try {
      const res = await axios.post(
        APIv2.AuthChangePassword,
        formState.values,
        getAxiosConfig()
      );
      formState.clear();
      setMessage(res.data.message, "green");
    } catch (err) {
      setMessage(err?.response?.data?.error || t('password.error.updatePassword'));
    }
    setLoading(false);
  };

  return (
    <Col alignItems="flex-start" maxWidth="100%">
      <H2 mb={4} bold>
        {t('password.title')} 
      </H2>
      <Text mb={4}>{t('password.description')}</Text>
      <Text
        {...label("password")}
        as="label"
        mb={[2, 3]}
        fontSize={[15, 16]}
        bold
      >
        {t('password.newPassword')}
      </Text>
      <Flex as="form" onSubmit={onSubmit}>
        <TextInput
          {...password({
            name: "password",
            validate: value => {
              const val = value.trim();
              if (!val || val.length < 8) {
                return t('password.error.passwordLenght');
              }
            }
          })}
          autoComplete="off"
          placeholder={t('password.newPassword')+"..."}
          width={[1, 2 / 3]}
          mr={3}
          required
        />
        <Button type="submit" disabled={loading} color="primary">
          <Icon name={loading ? "spinner" : "refresh"} mr={2} stroke={theme.icon.feature.main} />
          {loading ? tcommon('button.updating') : tcommon('button.updating')}
        </Button>
      </Flex>
      <Text color={message.color} mt={3} fontSize={15}>
        {message.text}
      </Text>
    </Col>
  );
};

export default SettingsPassword;
