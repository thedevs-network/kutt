
import React from "react";
import { Flex } from "reflexbox/styled-components";
import styled from "styled-components";

import { useTheme } from "../../hooks";
import {  useStoreState } from "../../store";
import { NavButton } from "../Button";
import Icon from "../Icon";
import {Th} from "../Table";

type Props = {
  limit: string,
  skip: string,
  onLimitChange: (limit: string) => void,
  onSkipChange: (skip: string) => void
}
  
const Nav = ({
  limit,
  skip,
  onLimitChange,
  onSkipChange
} : Props) => {
  const theme = useTheme()
  const links = useStoreState(s => s.links);
  const onNavChange = (nextPage: number) => () => {
    onSkipChange((parseInt(skip, 10) + nextPage).toString())
  };
  
  return  (
    <Th
      alignItems="center"
      justifyContent="flex-end"
      flexGrow={1}
      flexShrink={1}
    >
      <Flex as="ul" m={0} p={0} style={{ listStyle: "none" }}>
        {["10", "25", "50"].map(count => (
          <Flex key={count} ml={[10, 12]}>
            <NavButton
              disabled={limit === count}
              onClick={() => {
                onLimitChange(count);
                onSkipChange("0");
              }}
            >
              {count}
            </NavButton>
          </Flex>
        ))}
      </Flex>
      <Flex
        width="1px"
        height={20}
        mx={[3, 24]}
        style={{ backgroundColor: theme.table.border }}
      />
      <Flex>
        <NavButton
          onClick={onNavChange(-parseInt(limit, 10))}
          disabled={skip === "0"}
          px={2}
        >
          <Icon name="chevronLeft" size={15} />
        </NavButton>
        <NavButton
          onClick={onNavChange(parseInt(limit, 10))}
          disabled={
            parseInt(skip) + parseInt(limit, 10) > links.total
          }
          ml={12}
          px={2}
        >
          <Icon name="chevronRight" size={15} />
        </NavButton>
      </Flex>
    </Th>
  );
  
}
export default Nav;

