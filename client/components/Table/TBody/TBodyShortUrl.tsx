import React, { FC } from 'react';
import styled from 'styled-components';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Flex } from 'reflexbox/styled-components';

import TBodyButton from './TBodyButton';

interface Props {
  copiedIndex: number;
  handleCopy: any; // TODO: types
  index: number;
  url: {
    id: string;
    shortLink: string;
  };
}

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

const TBodyShortUrl: FC<Props> = ({ index, copiedIndex, handleCopy, url }) => (
  <Flex alignItems="center">
    {copiedIndex === index && <CopyText>Copied to clipboard!</CopyText>}
    <CopyToClipboard onCopy={() => handleCopy(index)} text={`${url.shortLink}`}>
      <TBodyButton>
        <Icon src="/images/copy.svg" />
      </TBodyButton>
    </CopyToClipboard>
    <a href={`${url.shortLink}`}>{`${url.shortLink.replace(
      /^https?:\/\//,
      ''
    )}`}</a>
  </Flex>
);

export default TBodyShortUrl;
