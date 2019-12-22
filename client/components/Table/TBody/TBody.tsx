import React, { FC } from 'react';
import { connect } from 'react-redux';
import styled, { css } from 'styled-components';
import distanceInWordsToNow from 'date-fns/formatDistanceToNow';
import { ifProp } from 'styled-tools';
import { Flex } from 'reflexbox/styled-components';

import TBodyShortUrl from './TBodyShortUrl';
import TBodyCount from './TBodyCount';

interface Props {
  urls: Array<{
    id: string;
    count: number;
    created_at: string;
    password: boolean;
    target: string;
  }>;
  copiedIndex: number;
  showModal: any; // TODO: types
  tableLoading: boolean;
  handleCopy: any;
}

const TBody = styled(Flex).attrs({
  as: 'tbody',
  flex: '1 1 auto',
  flexDirection: 'column',
})<{ loading: boolean }>`
  ${ifProp(
    'loading',
    css`
      opacity: 0.2;
    `
  )}

  tr:hover {
    background-color: #f8f8f8;

    td:after {
      background: linear-gradient(to left, #f8f8f8, #f8f8f8, transparent);
    }
  }
`;

const Td = styled(Flex).attrs({
  as: 'td',
  flexBasis: 0,
})<{ flex?: string; withFade?: boolean; date?: boolean }>`
  white-space: nowrap;
  overflow: hidden;

  ${ifProp(
    'withFade',
    css`
    :after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      height: 100%;
      width: 56px;
      background: linear-gradient(to left, white, white, transparent);
  `
  )}

  :last-child {
    justify-content: space-between;
  }

  a {
    color: #2196f3;
    text-decoration: none;
    box-sizing: border-box;
    border-bottom: 1px dotted transparent;
    transition: all 0.2s ease-out;

    :hover {
      border-bottom-color: #2196f3;
    }
  }

  ${ifProp(
    'date',
    css`
      font-size: 15px;
    `
  )}

  @media only screen and (max-width: 768px) {
    flex: 1;
    :nth-child(2) {
      display: none;
    }
  }

  @media only screen and (max-width: 510px) {
    :nth-child(1) {
      display: none;
    }
  }
`;

const TableBody: FC<Props> = ({
  copiedIndex,
  handleCopy,
  tableLoading,
  showModal,
  urls,
}) => {
  const showList = (url, index) => (
    <tr key={`tbody-${index}`}>
      <Td flex="2 2 0" withFade>
        <a href={url.target}>{url.target}</a>
      </Td>
      <Td flex="1 1 0" date>
        {`${distanceInWordsToNow(new Date(url.created_at))} ago`}
      </Td>
      <Td flex="1 1 0" withFade>
        <TBodyShortUrl
          index={index}
          copiedIndex={copiedIndex}
          handleCopy={handleCopy}
          url={url}
        />
      </Td>
      <Td flex="1 1 0">
        <TBodyCount url={url} showModal={showModal(url)} />
      </Td>
    </tr>
  );
  return (
    <TBody loading={tableLoading}>
      {urls.length ? (
        urls.map(showList)
      ) : (
        <tr>
          <Td>Nothing to show.</Td>
        </tr>
      )}
    </TBody>
  );
};

const mapStateToProps = ({ loading: { table: tableLoading } }) => ({
  tableLoading,
});

export default connect(mapStateToProps)(TableBody);
