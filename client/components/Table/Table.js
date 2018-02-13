import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled from 'styled-components';
import THead from './THead';
import TBody from './TBody';
import TableOptions from './TableOptions';
import { deleteShortUrl, getUrlsList } from '../../actions';
import Modal from '../Modal';

const Wrapper = styled.div`
  width: 1200px;
  max-width: 95%;
  display: flex;
  flex-direction: column;
  margin: 40px 0 120px;
`;

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

class Table extends Component {
  constructor() {
    super();
    this.state = {
      copiedIndex: -1,
      modalUrlId: '',
      modalUrlDomain: '',
      showModal: false,
    };
    this.handleCopy = this.handleCopy.bind(this);
    this.showModal = this.showModal.bind(this);
    this.closeModal = this.closeModal.bind(this);
    this.deleteUrl = this.deleteUrl.bind(this);
  }

  handleCopy(index) {
    this.setState({ copiedIndex: index });
    setTimeout(() => {
      this.setState({ copiedIndex: -1 });
    }, 1500);
  }

  showModal(e) {
    e.preventDefault();
    const modalUrlId = e.currentTarget.dataset.id;
    const modalUrlDomain = e.currentTarget.dataset.host;
    this.setState({
      modalUrlId,
      modalUrlDomain,
      showModal: true,
    });
  }

  closeModal() {
    this.setState({
      modalUrlId: '',
      modalUrlDomain: '',
      showModal: false,
    });
  }

  deleteUrl() {
    this.closeModal();
    const { modalUrlId, modalUrlDomain } = this.state;
    this.props.deleteShortUrl({ id: modalUrlId, domain: modalUrlDomain });
  }

  render() {
    const { copiedIndex } = this.state;
    const { url } = this.props;
    return (
      <Wrapper>
        <Title>Recent shortened links.</Title>
        <TableWrapper>
          <THead />
          <TBody
            copiedIndex={copiedIndex}
            handleCopy={this.handleCopy}
            urls={url.list}
            showModal={this.showModal}
          />
          <TFoot>
            <TableOptions nosearch />
          </TFoot>
        </TableWrapper>
        <Modal show={this.state.showModal} handler={this.deleteUrl} close={this.closeModal}>
          Are you sure do you want to delete the short URL and its stats?
        </Modal>
      </Wrapper>
    );
  }
}

Table.propTypes = {
  deleteShortUrl: PropTypes.func.isRequired,
  url: PropTypes.shape({
    list: PropTypes.array.isRequired,
  }).isRequired,
};

const mapStateToProps = ({ url }) => ({ url });

const mapDispatchToProps = dispatch => ({
  deleteShortUrl: bindActionCreators(deleteShortUrl, dispatch),
  getUrlsList: bindActionCreators(getUrlsList, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(Table);
