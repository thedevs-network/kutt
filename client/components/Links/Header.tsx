
import React , {useState} from "react";
import Nav from "./Nav"
import { Flex } from "reflexbox/styled-components";
import { Checkbox, TextInput } from "../Input";
import { useStoreState } from "../../store";
import { useTranslation } from 'react-i18next';
import {Tr, Th} from "../Table";

type Props = {
  limit: number;
  onLimitChange: (limit: number) => void;
  skip: number;
  onSkipChange: (skip: number) => void;
  search: any;
  onSearchChange: (search: string) => void;
  all: boolean;
  onAllChange: (all: boolean) => void;
}

const Header = ({
  limit,
  onLimitChange,
  skip,
  onSkipChange,
  search,
  onSearchChange,
  all,
  onAllChange,
  ...props
}: Props) => {
  const isAdmin = useStoreState(s => s.auth.isAdmin);
  const { t } = useTranslation();

  return (
    <thead>
      <Tr justifyContent="space-between">
        <Th flexGrow={1} flexShrink={1}>
          <Flex>
            <TextInput
              value={search}
              onChange={onSearchChange}
              placeholder={t('linksTable.phSearch') + "..."}
              height={[30, 32]}
              placeholderSize={[13, 13, 13, 13]}
              fontSize={[14]}
              pl={12}
              pr={12}
              width={[1]}
              br="3px"
              bbw="2px"
            />

            {isAdmin && (
              <Checkbox
                name="allLinks"
                checked={all}
                onChange={() => onAllChange(!all)}
                label={t('linksTable.cBoxAllLink')}
                ml={3}
                fontSize={[14, 15]}
                width={[15, 16]}
                height={[15, 16]}
              />
            )}
          </Flex>
        </Th>
        <Nav limit={limit} onLimitChange={onLimitChange} skip={skip} onSkipChange={onSkipChange}></Nav>
      </Tr>

    </thead>
  )
}
export default Header;