import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import TBodyButton from './TBodyButton';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
`;

const CopyText = styled.div`
  position: absolute;
  top: 0;
  left: 40px;
  font-size: 11px;
  color: green;
`;

const Icon = styled.img`
  width: 12px;
  height: 12px;
`;

const TBodyShortUrl = ({ index, copiedIndex, handleCopy, url }) => (
  <Wrapper>
    {copiedIndex === index && <CopyText>Copied to clipboard!</CopyText>}
    <CopyToClipboard onCopy={() => handleCopy(index)} text={`${url.shortLink}`}>
      <TBodyButton>
        <Icon src="/images/copy.svg" />
      </TBodyButton>
    </CopyToClipboard>
    <a href={`${url.shortLink}`}>{`${url.shortLink.replace(/^https?:\/\//, '')}`}</a>
  </Wrapper>
);

TBodyShortUrl.propTypes = {
  copiedIndex: PropTypes.number.isRequired,
  handleCopy: PropTypes.func.isRequired,
  index: PropTypes.number.isRequired,
  url: PropTypes.shape({
    id: PropTypes.string.isRequired,
  }).isRequired,
};

export default TBodyShortUrl;
