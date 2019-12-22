import React, { FC } from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

import HeaderLogo from "./HeaderLogo";
import HeaderLeftMenu from "./HeaderLeftMenu";
import HeaderRightMenu from "./HeaderRightMenu";

const Header: FC = () => (
  <Flex
    width={1232}
    maxWidth="100%"
    p={[16, 16, "0 32px"]}
    mb={[32, 32, 0]}
    height={["auto", "auto", 102]}
    justifyContent="space-between"
    alignItems={["flex-start", "flex-start", "center"]}
  >
    <Flex
      flexDirection={["column", "column", "row"]}
      alignItems={["flex-start", "flex-start", "stretch"]}
    >
      <HeaderLogo />
      <HeaderLeftMenu />
    </Flex>
    <HeaderRightMenu />
  </Flex>
);

export default Header;
