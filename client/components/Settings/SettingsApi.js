import React from 'react';
import PropTypes from 'prop-types';
import styled, { css } from 'styled-components';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import Button from '../Button';
import { fadeIn } from '../../helpers/animations';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const ApiKeyWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  margin: 16px 0;

  button {
    margin-right: 16px;
  }

  ${({ apikey }) =>
    apikey &&
    css`
      flex-direction: column;
      align-items: flex-start;
      > span {
        margin-bottom: 32px;
      }
    `};

  @media only screen and (max-width: 768px) {
    width: 100%;
    overflow-wrap: break-word;
  }
`;

const KeyWrapper = styled.div`
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 16px;
`;

const ApiKey = styled.span`
  max-width: 100%;
  margin-right: 16px;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 2px dotted #999;

  @media only screen and (max-width: 768px) {
    font-size: 14px;
  }

  @media only screen and (max-width: 520px) {
    margin-bottom: 16px;
  }
`;

const Link = styled.a`
  margin: 16px 0;

  @media only screen and (max-width: 768px) {
    margin: 8px 0;
  }
`;

const CopyMessage = styled.p`
  position: absolute;
  top: -42px;
  left: 0;
  font-size: 14px;
  color: #689f38;
  animation: ${fadeIn} 0.3s ease-out;
`;

const SettingsApi = ({ apikey, generateKey, loader, isCopied, onCopy }) => (
  <Wrapper>
    <h3>API</h3>
    <p>
      In additional to this website, you can use the API to create, delete and get shortend URLs. If
      {" you're"} not familiar with API, {"don't"} generate the key. DO NOT share this key on the
      client side of your website.
    </p>
    <ApiKeyWrapper apikey={apikey}>
      {isCopied && <CopyMessage>Copied to clipboard.</CopyMessage>}
      {apikey && (
        <KeyWrapper>
          <ApiKey>{apikey}</ApiKey>
          <CopyToClipboard text={apikey} onCopy={onCopy}>
            <Button icon="copy">Copy</Button>
          </CopyToClipboard>
        </KeyWrapper>
      )}
      <Button color="purple" icon={loader ? 'loader' : 'zap'} onClick={generateKey}>
        {apikey ? 'Regenerate' : 'Generate'} key
      </Button>
    </ApiKeyWrapper>
    <Link href="https://github.com/thedevs-network/kutt#api" title="API Docs" target="_blank">
      Read API docs
    </Link>
  </Wrapper>
);

SettingsApi.propTypes = {
  apikey: PropTypes.string.isRequired,
  loader: PropTypes.bool.isRequired,
  isCopied: PropTypes.bool.isRequired,
  generateKey: PropTypes.func.isRequired,
  onCopy: PropTypes.func.isRequired,
};

export default SettingsApi;
