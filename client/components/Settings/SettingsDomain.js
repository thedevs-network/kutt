import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import TextInput from '../TextInput';
import Button from '../Button';
import Error from '../Error';
import { fadeIn } from '../../helpers/animations';

const Form = styled.form`
  position: relative;
  display: flex;
  margin: 32px 0;
  animation: ${fadeIn} 0.8s ease;

  input {
    flex: 0 0 auto;
    margin-right: 16px;
  }

  @media only screen and (max-width: 768px) {
    margin: 16px 0;
  }
`;

const DomainWrapper = styled.div`
  display: flex;
  align-items: center;
  margin: 32px 0;
  animation: ${fadeIn} 0.8s ease;

  button {
    margin-right: 16px;
  }

  @media only screen and (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;

    > * {
      margin: 8px 0;
    }
  }
`;

const Domain = styled.span`
  margin-right: 16px;
  font-size: 20px;
  font-weight: bold;
  border-bottom: 2px dotted #999;
`;

const SettingsDomain = ({ settings, handleCustomDomain, loading, showDomainInput, showModal }) => (
  <div>
    <h3>Custom domain</h3>
    <p>
      You can set a custom domain for your short URLs, so instead of <b>kutt.it/shorturl</b> you can
      have <b>example.com/shorturl.</b>
    </p>
    <p>
      Point your domain A record to <b>164.132.153.221</b> then add the domain via form below:
    </p>
    {settings.customDomain && !settings.domainInput ? (
      <DomainWrapper>
        <Domain>{settings.customDomain}</Domain>
        <Button icon="edit" onClick={showDomainInput}>
          Change
        </Button>
        <Button color="gray" icon="x" onClick={showModal}>
          Delete
        </Button>
      </DomainWrapper>
    ) : (
      <Form onSubmit={handleCustomDomain}>
        <Error type="domain" left={0} bottom={-48} />
        <TextInput
          id="customdomain"
          name="customdomain"
          type="text"
          placeholder="example.com"
          defaultValue={settings.customDomain}
          height={44}
          small
        />
        <Button type="submit" color="purple" icon={loading ? 'loader' : ''}>
          Set domain
        </Button>
      </Form>
    )}
  </div>
);

SettingsDomain.propTypes = {
  settings: PropTypes.shape({
    customDomain: PropTypes.string.isRequired,
    domainInput: PropTypes.bool.isRequired,
  }).isRequired,
  handleCustomDomain: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  showDomainInput: PropTypes.func.isRequired,
  showModal: PropTypes.func.isRequired,
};

export default SettingsDomain;
