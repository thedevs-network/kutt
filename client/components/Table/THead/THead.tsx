import React, { FC } from 'react';
import styled, { css } from 'styled-components';
import { Flex } from 'reflexbox';

import TableOptions from '../../TableOptions';

const THead = styled(Flex).attrs({
  as: 'thead',
  flexDirection: 'column',
  flex: '1 1 auto',
})`
  background-color: #f1f1f1;
  border-top-right-radius: 12px;
  border-top-left-radius: 12px;

  tr {
    border-bottom: 1px solid #dedede;
  }
`;

const Th = styled(Flex).attrs({
  as: 'th',
  justifyContent: 'start',
  alignItems: 'center',
  flexBasis: 0,
})`
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

const TableHead: FC = () => (
  <THead>
    <TableOptions />
    <tr>
      <Th flex="2 2 0">Original URL</Th>
      <Th flex="1 1 0">Created</Th>
      <Th flex="1 1 0">Short URL</Th>
      <Th flex="1 1 0">Clicks</Th>
    </tr>
  </THead>
);

export default TableHead;
