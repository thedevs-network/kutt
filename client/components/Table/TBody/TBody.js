import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import styled, { css } from 'styled-components';
import distanceInWordsToNow from 'date-fns/formatDistanceToNow';
import TBodyShortUrl from './TBodyShortUrl';
import TBodyCount from './TBodyCount';

const TBody = styled.tbody`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;

  ${({ loading }) =>
    loading &&
    css`
      opacity: 0.2;
    `};

  tr:hover {
    background-color: #f8f8f8;

    td:after {
      background: linear-gradient(to left, #f8f8f8, #f8f8f8, transparent);
    }
  }
`;

const Td = styled.td`
  white-space: nowrap;
  overflow: hidden;

  ${({ withFade }) =>
    withFade &&
    css`
      :after {
        content: '';
        position: absolute;
        right: 0;
        top: 0;
        height: 100%;
        width: 56px;
        background: linear-gradient(to left, white, white, transparent);
      }
    `};

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

  ${({ date }) =>
    date &&
    css`
      font-size: 15px;
    `};

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

const TableBody = ({ copiedIndex, handleCopy, tableLoading, showModal, urls }) => {
  const showList = (url, index) => (
    <tr key={`tbody-${index}`}>
      <Td flex="2" withFade>
        <a href={url.target}>{url.target}</a>
      </Td>
      <Td flex="1" date>
        {`${distanceInWordsToNow(new Date(url.created_at))} ago`}
      </Td>
      <Td flex="1" withFade>
        <TBodyShortUrl index={index} copiedIndex={copiedIndex} handleCopy={handleCopy} url={url} />
      </Td>
      <Td flex="1">
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

TableBody.propTypes = {
  urls: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      count: PropTypes.number,
      created_at: PropTypes.string.isRequired,
      password: PropTypes.bool,
      target: PropTypes.string.isRequired,
    })
  ).isRequired,
  copiedIndex: PropTypes.number.isRequired,
  showModal: PropTypes.func.isRequired,
  tableLoading: PropTypes.bool.isRequired,
  handleCopy: PropTypes.func.isRequired,
};

const mapStateToProps = ({ loading: { table: tableLoading } }) => ({ tableLoading });

export default connect(mapStateToProps)(TableBody);
