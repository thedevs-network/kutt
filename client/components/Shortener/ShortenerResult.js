import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import Button from '../Button';
import Loading from '../PageLoading';
import { fadeIn } from '../../helpers/animations';

const Wrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;

  button {
    margin-left: 24px;
  }
`;

const Url = styled.h2`
  margin: 8px 0;
  font-size: 32px;
  font-weight: 300;
  border-bottom: 2px dotted #aaa;
  cursor: pointer;
  transition: all 0.2s ease;

  :hover {
    opacity: 0.5;
  }

  @media only screen and (max-width: 448px) {
    font-size: 24px;
  }
`;

const CopyMessage = styled.p`
  position: absolute;
  top: -32px;
  left: 0;
  font-size: 14px;
  color: #689f38;
  animation: ${fadeIn} 0.3s ease-out;
`;

const ShortenerResult = ({ copyHandler, isCopied, loading, url }) =>
  loading ? (
    <Loading />
  ) : (
    <Wrapper>
      {isCopied && <CopyMessage>Copied to clipboard.</CopyMessage>}
      <CopyToClipboard text={url.list[0].shortUrl} onCopy={copyHandler}>
        <Url>{url.list[0].shortUrl.replace(/^http?:\/\//, '')}</Url>
      </CopyToClipboard>
      <CopyToClipboard text={url.list[0].shortUrl} onCopy={copyHandler}>
        <Button icon="copy">Copy</Button>
      </CopyToClipboard>
    </Wrapper>
  );

ShortenerResult.propTypes = {
  copyHandler: PropTypes.func.isRequired,
  isCopied: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  url: PropTypes.shape({
    list: PropTypes.array.isRequired,
  }).isRequired,
};

export default ShortenerResult;
