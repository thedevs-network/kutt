
import React from "react";
import Nav from "./Nav"
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

const Tr = styled(Flex).attrs({ as: "tr", px: [12, 12, 2] })``;
type Props = {
  limit: number;
  onLimitChange: (limit: number) => void;
  skip: number;
  onSkipChange: (skip: number) => void;
}

const Footer = ({
  limit,
  onLimitChange,
  skip,
  onSkipChange
}: Props) => {

  return (
    <tfoot>
    <Tr justifyContent="flex-end">
      <Nav limit={limit} onLimitChange={onLimitChange} skip={skip} onSkipChange={onSkipChange}></Nav>
    </Tr>
  </tfoot>
  )
}
export default Footer;