import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import TextInput from '../TextInput';
import Button from '../Button';
import Checkbox from '../Checkbox';

const Form = styled.form`
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 32px 0;

  input {
    flex: 0 0 auto;
    margin-right: 16px;
  }
`;

const InputWrapper = styled.div`
  display: flex;
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

const SettingsBan = props => (
  <div>
    <h3>Ban link</h3>
    <Form onSubmit={props.onSubmitBan}>
      <InputWrapper>
        <Message>{props.message}</Message>
        <TextInput
          id="id"
          name="id"
          type="text"
          placeholder="Link ID (e.g. K7b2A)"
          height={44}
          small
        />
        <Button type="submit" icon={props.loading ? 'loader' : 'lock'} disabled={props.loading}>
          {props.loading ? 'Baning...' : 'Ban'}
        </Button>
      </InputWrapper>
      <div>
        <Checkbox
          id="user"
          name="user"
          label="Ban user (and all of their links)"
          withMargin={false}
          checked={props.user}
          onClick={props.onChangeBanCheckboxes('user')}
        />
        <Checkbox
          id="domain"
          name="domain"
          label="Ban domain"
          withMargin={false}
          checked={props.domain}
          onClick={props.onChangeBanCheckboxes('domain')}
        />
        <Checkbox
          id="host"
          name="host"
          label="Ban Host/IP"
          withMargin={false}
          checked={props.host}
          onClick={props.onChangeBanCheckboxes('host')}
        />
      </div>
      <Error>{props.error}</Error>
    </Form>
  </div>
);

SettingsBan.propTypes = {
  domain: PropTypes.bool.isRequired,
  error: PropTypes.string.isRequired,
  host: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  onChangeBanCheckboxes: PropTypes.func.isRequired,
  onSubmitBan: PropTypes.func.isRequired,
  user: PropTypes.bool.isRequired,
};

export default SettingsBan;
