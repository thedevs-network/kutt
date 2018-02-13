import React from 'react';
import styled, { css } from 'styled-components';
import TableOptions from '../TableOptions';

const THead = styled.thead`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  background-color: #f1f1f1;
  border-top-right-radius: 12px;
  border-top-left-radius: 12px;

  tr {
    border-bottom: 1px solid #dedede;
  }
`;

const Th = styled.th`
  display: flex;
  justify-content: start;
  align-items: center;

  ${({ flex }) =>
    flex &&
    css`
      flex: ${`${flex} ${flex}`} 0;
    `};

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

const TableHead = () => (
  <THead>
    <TableOptions />
    <tr>
      <Th flex="2">Original URL</Th>
      <Th flex="1">Created</Th>
      <Th flex="1">Short URL</Th>
      <Th flex="1">Clicks</Th>
    </tr>
  </THead>
);

export default TableHead;
