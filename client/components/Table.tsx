import React, { Component, FC, useState } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled from 'styled-components';
import { Flex } from 'reflexbox/styled-components';

import THead from './Table/THead';
import TBody from './Table/TBody';
import TableOptions from './TableOptions';
import { deleteShortUrl, getUrlsList } from '../actions';
import Modal from './Modal';

interface Props {
  deleteShortUrl: any; // TODO: types
  url: {
    list: any[]; // TODO: types
  };
}

const Title = styled.h2`
  font-size: 24px;
  font-weight: 300;

  @media only screen and (max-width: 768px) {
    font-size: 18px;
  }
`;

const TableWrapper = styled.table`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 6px 30px rgba(50, 50, 50, 0.2);

  tr {
    display: flex;
    flex: 1 1 auto;
    padding: 0 24px;
    justify-content: space-between;
    border-bottom: 1px solid #eaeaea;
  }

  th,
  td {
    position: relative;
    display: flex;
    padding: 16px 0;
    align-items: center;
  }

  @media only screen and (max-width: 768px) {
    font-size: 13px;
  }

  @media only screen and (max-width: 510px) {
    tr {
      padding: 0 16px;
    }
    th,
    td {
      padding: 12px 0;
    }
  }
`;

const TFoot = styled.tfoot`
  background-color: #f1f1f1;
  border-bottom-right-radius: 12px;
  border-bottom-left-radius: 12px;
`;

const defualtModal = {
  id: '',
  domain: '',
  show: false,
};

const Table: FC<Props> = ({ deleteShortUrl, url }) => {
  const [copiedIndex, setCopiedIndex] = useState(-1);
  const [modal, setModal] = useState(defualtModal);

  function handleCopy(index) {
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(-1);
    }, 1500);
  }

  function showModal(url) {
    return e => {
      e.preventDefault();
      setModal({
        id: url.address,
        domain: url.domain,
        show: true,
      });
    };
  }

  const closeModal = () => setModal(defualtModal);

  function deleteUrl() {
    closeModal();
    deleteShortUrl({ id: modal.id, domain: modal.domain });
  }

  return (
    <Flex
      width={1200}
      maxWidth="95%"
      flexDirection="column"
      margin="40px 0 120px"
    >
      <Title>Recent shortened links.</Title>
      <TableWrapper>
        <THead />
        <TBody
          copiedIndex={copiedIndex}
          handleCopy={handleCopy}
          urls={url.list}
          showModal={showModal}
        />
        <TFoot>
          <TableOptions nosearch />
        </TFoot>
      </TableWrapper>
      <Modal show={modal.show} handler={deleteUrl} close={closeModal}>
        Are you sure do you want to delete the short URL and its stats?
      </Modal>
    </Flex>
  );
};

const mapStateToProps = ({ url }) => ({ url });

const mapDispatchToProps = dispatch => ({
  deleteShortUrl: bindActionCreators(deleteShortUrl, dispatch),
  getUrlsList: bindActionCreators(getUrlsList, dispatch),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Table);
