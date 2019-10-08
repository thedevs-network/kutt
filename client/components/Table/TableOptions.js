import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import styled, { css } from 'styled-components';
import TableNav from './TableNav';
import TextInput from '../TextInput';
import { getUrlsList } from '../../actions';

const Tr = styled.tr`
  display: flex;
  align-items: center;

  thead & {
    border-bottom: 1px solid #ddd !important;
  }
`;

const Th = styled.th`
  display: flex;
  align-items: center;

  ${({ flex }) =>
    flex &&
    css`
      flex: ${`${flex} ${flex}`} 0;
    `};
`;

const Divider = styled.div`
  margin: 0 16px 0 24px;
  width: 1px;
  height: 20px;
  background-color: #ccc;

  @media only screen and (max-width: 768px) {
    margin: 0 4px 0 12px;
  }

  @media only screen and (max-width: 510px) {
    display: none;
  }
`;

const ListCount = styled.div`
  display: flex;
  align-items: center;
`;

const Ul = styled.ul`
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    margin: 0 0 0 12px;
    list-style: none;

    @media only screen and (max-width: 768px) {
      margin-left: 8px;
    }
  }

  @media only screen and (max-width: 510px) {
    display: none;
  }
`;

const Button = styled.button`
  display: flex;
  padding: 4px 8px;
  border: none;
  font-size: 12px;
  border-radius: 4px;
  box-shadow: 0 0px 10px rgba(100, 100, 100, 0.1);
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease-out;
  box-sizing: border-box;

  ${({ active }) =>
    !active &&
    css`
      border: 1px solid #ddd;
      background-color: #f5f5f5;
      box-shadow: 0 0px 5px rgba(150, 150, 150, 0.1);

      :hover {
        border-color: 1px solid #ccc;
        background-color: white;
      }
    `};

  @media only screen and (max-width: 768px) {
    font-size: 10px;
  }
`;

class TableOptions extends Component {
  constructor() {
    super();
    this.state = {
      search: '',
    };
    this.submitSearch = this.submitSearch.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.handleCount = this.handleCount.bind(this);
    this.handleNav = this.handleNav.bind(this);
  }

  submitSearch(e) {
    e.preventDefault();
    this.props.getUrlsList({ search: this.state.search });
  }

  handleSearch(e) {
    this.setState({ search: e.currentTarget.value });
  }

  handleCount(e) {
    const count = Number(e.target.textContent);
    this.props.getUrlsList({ count });
  }

  handleNav(num) {
    return (e) => {
      const { active } = e.target.dataset;
      if (active === 'false') return null;
      console.log({ page: this.props.url.page, num });
      return this.props.getUrlsList({ page: this.props.url.page + num });
    }
  }

  render() {
    const { count, countAll, page } = this.props.url;
    return (
      <Tr>
        <Th>
          {!this.props.nosearch && (
            <form onSubmit={this.submitSearch}>
              <TextInput
                id="search"
                name="search"
                value={this.state.search}
                placeholder="Search..."
                onChange={this.handleSearch}
                tiny
              />
            </form>
          )}
        </Th>
        <Th>
          <ListCount>
            <Ul>
              <li>
                <Button active={count === 10} onClick={this.handleCount}>
                  10
                </Button>
              </li>
              <li>
                <Button active={count === 25} onClick={this.handleCount}>
                  25
                </Button>
              </li>
              <li>
                <Button active={count === 50} onClick={this.handleCount}>
                  50
                </Button>
              </li>
            </Ul>
          </ListCount>
          <Divider />
          <TableNav handleNav={this.handleNav} next={page * count < countAll} prev={page > 1} />
        </Th>
      </Tr>
    );
  }
}

TableOptions.propTypes = {
  getUrlsList: PropTypes.func.isRequired,
  nosearch: PropTypes.bool,
  url: PropTypes.shape({
    page: PropTypes.number.isRequired,
    count: PropTypes.number.isRequired,
    countAll: PropTypes.number.isRequired,
  }).isRequired,
};

TableOptions.defaultProps = {
  nosearch: false,
};

const mapStateToProps = ({ url }) => ({ url });

const mapDispatchToProps = dispatch => ({
  getUrlsList: bindActionCreators(getUrlsList, dispatch),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TableOptions);
