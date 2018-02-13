import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import TextInput from '../TextInput';
import Button from '../Button';

const Form = styled.form`
  position: relative;
  display: flex;
  margin: 32px 0;

  input {
    flex: 0 0 auto;
    margin-right: 16px;
  }
`;

const Message = styled.div`
  position: absolute;
  left: 0;
  bottom: -32px;
  color: green;
`;

const Error = styled.div`
  position: absolute;
  left: 0;
  bottom: -32px;
  color: red;
`;

const SettingsPassword = ({ changePassword, error, message }) => (
  <div>
    <h3>Change password</h3>
    <Form onSubmit={changePassword}>
      <Message>{message}</Message>
      <TextInput
        id="password"
        name="password"
        type="password"
        placeholder="New password"
        height={44}
        small
      />
      <Button type="submit" icon="refresh">
        Update
      </Button>
      <Error>{error}</Error>
    </Form>
  </div>
);

SettingsPassword.propTypes = {
  error: PropTypes.string.isRequired,
  changePassword: PropTypes.func.isRequired,
  message: PropTypes.string.isRequired,
};

export default SettingsPassword;
