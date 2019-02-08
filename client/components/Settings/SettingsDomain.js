import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import TextInput from '../TextInput';
import Checkbox from '../Checkbox';
import Button from '../Button';
import Error from '../Error';
import { fadeIn } from '../../helpers/animations';

const Form = styled.form`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
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
`;

const ButtonWrapper = styled.div`
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

const Domain = styled.h4`
  margin: 0 16px 0 0;
  font-size: 20px;
  font-weight: bold;

  span {
    border-bottom: 2px dotted #999;
  }
`;

const Homepage = styled.h6`
  margin: 0 16px 0 0;
  font-size: 14px;
  font-weight: 300;

  span {
    border-bottom: 2px dotted #999;
  }
`;

const InputWrapper = styled.div`
  display: flex;
  align-items: center;
`;

const LabelWrapper = styled.div`
  display: flex;
  flex-direction: column;

  span {
    font-weight: bold;
    margin-bottom: 8px;
  }
`;

const SettingsDomain = ({
  settings,
  handleCustomDomain,
  loading,
  showDomainInput,
  showModal,
  useHttps,
  handleCheckbox,
}) => (
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
      <div>
        <DomainWrapper>
          <Domain>
            <span>{settings.customDomain}</span>
          </Domain>
          {settings.useHttps && <Homepage>(With HTTPS)</Homepage>}
          <Homepage>
            (Homepage redirects to <span>{settings.homepage || window.location.hostname}</span>)
          </Homepage>
        </DomainWrapper>
        <ButtonWrapper>
          <Button icon="edit" onClick={showDomainInput}>
            Change
          </Button>
          <Button color="gray" icon="x" onClick={showModal}>
            Delete
          </Button>
        </ButtonWrapper>
      </div>
    ) : (
      <Form onSubmit={handleCustomDomain}>
        <Error type="domain" left={0} bottom={-54} />
        <InputWrapper>
          <LabelWrapper htmlFor="customdomain">
            <span>Domain</span>
            <TextInput
              id="customdomain"
              name="customdomain"
              type="text"
              placeholder="example.com"
              defaultValue={settings.customDomain}
              height={44}
              small
            />
          </LabelWrapper>
          <LabelWrapper>
            <span>Homepage (Optional)</span>
            <TextInput
              id="homepage"
              name="homepage"
              type="text"
              placeholder="Homepage URL"
              defaultValue={settings.homepage}
              height={44}
              small
            />
          </LabelWrapper>
        </InputWrapper>
        <Checkbox
          checked={useHttps === null ? settings.useHttps : useHttps}
          id="useHttps"
          name="useHttps"
          onClick={handleCheckbox}
          withMargin={false}
          label="Use HTTPS (We don't handle the SSL, you should take care of it)"
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
  handleCheckbox: PropTypes.func.isRequired,
  useHttps: PropTypes.bool.isRequired,
};

export default SettingsDomain;
