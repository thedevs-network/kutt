import React, { FC, useState } from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import styled, { css } from "styled-components";
import { ifProp } from "styled-tools";
import { Flex } from "reflexbox/styled-components";

import TableNav from "./TableNav";
import TextInput from "./TextInput";
import { getUrlsList } from "../actions";

interface Props {
  getUrlsList: any; // TODO: types
  nosearch?: boolean;
  url: {
    page: number;
    count: number;
    countAll: number;
  };
}

const Tr = styled(Flex).attrs({ as: "tr", alignItems: "center" })`
  thead & {
    border-bottom: 1px solid #ddd !important;
  }
`;

const Th = styled(Flex).attrs({ as: "th", alignItems: "center" })``;

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

const Ul = styled(Flex).attrs({ as: "ul" })`
  margin: 0;
  padding: 0;
  list-style: none;

  @media only screen and (max-width: 510px) {
    display: none;
  }
`;

const Li = styled(Flex).attrs({ as: "li" })`
  li {
    margin: 0 0 0 12px;
    list-style: none;

    @media only screen and (max-width: 768px) {
      margin-left: 8px;
    }
  }
`;

const Button = styled.button<{ active: boolean }>`
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

  ${ifProp(
    { active: false },
    css`
      border: 1px solid #ddd;
      background-color: #f5f5f5;
      box-shadow: 0 0px 5px rgba(150, 150, 150, 0.1);

      :hover {
        border-color: 1px solid #ccc;
        background-color: white;
      }
    `
  )}
  @media only screen and (max-width: 768px) {
    font-size: 10px;
  }
`;

const TableOptions: FC<Props> = ({ getUrlsList, nosearch, url }) => {
  const [search, setSearch] = useState();
  const [count, setCount] = useState();

  function submitSearch(e) {
    e.preventDefault();
    getUrlsList({ search });
  }

  const handleCount = e => setCount(Number(e.target.textContent));

  function handleNav(num) {
    return e => {
      const { active } = e.target.dataset;
      if (active === "false") return null;
      return getUrlsList({ page: url.page + num });
    };
  }

  return (
    <Tr>
      <Th>
        {!nosearch && (
          <form onSubmit={submitSearch}>
            <TextInput
              as="input"
              id="search"
              name="search"
              value={search}
              placeholder="Search..."
              onChange={e => setSearch(e.target.value)}
              tiny
            />
          </form>
        )}
      </Th>
      <Th>
        <Flex alignItems="center">
          <Ul>
            {[10, 25, 50].map(c => (
              <Li key={c}>
                <Button active={count === c} onClick={handleCount}>
                  {c}
                </Button>
              </Li>
            ))}
          </Ul>
        </Flex>
        <Divider />
        <TableNav
          handleNav={handleNav}
          next={url.page * count < url.countAll}
          prev={url.page > 1}
        />
      </Th>
    </Tr>
  );
};

TableOptions.defaultProps = {
  nosearch: false
};

const mapStateToProps = ({ url }) => ({ url });

const mapDispatchToProps = dispatch => ({
  getUrlsList: bindActionCreators(getUrlsList, dispatch)
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TableOptions);
