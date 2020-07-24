
import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import React from "react";

import { useStoreActions, useStoreState } from "../store";
import {  TextInput } from "./Input";
import { Col } from "./Layout";
import { H2 } from "../components/Text";
import { useTranslation } from 'react-i18next';


interface Form {
    all: boolean;
    limit: string;
    skip: string;
    search: string;
    pageSearch: boolean;
  }

const defaultDomain = process.env.DEFAULT_DOMAIN;

const SearchBar = () => {
  const { t } = useTranslation("search");
  const links = useStoreState(s => s.links);
  const { get } = useStoreActions(s => s.links);
    const [formState, { label, checkbox, text }] = useFormState<Form>(
      { skip: "0", limit: "10", all: false, pageSearch: true },
      { withIds: true }
    );
  
    const options = formState.values;
    const onSubmit = e => {
        e.preventDefault();
       
         get(options);
      };

  return (
    <Col width={800} maxWidth="100%" px={[3]} flex="0 0 auto" mt={4}>
      <Flex
      as="form" onKeyUpCapture={onSubmit}
      id="shortenerform"
      width={1}
      alignItems="center"
      justifyContent="center"
      style={{ position: "relative" }}
    >
    <H2 my={4} light>
    {process.env.SITE_NAME}/
    </H2>
    <TextInput
        {...text("search")}
        placeholder={t('phSearch')}
        autoComplete="off"
        placeholderSize={[16, 17, 18]}
        fontSize={[18, 20, 22]}
        height={[58, 64, 72]}
        width={[400, 500, 700]}
        style={{marginLeft:"5px"}}
        px={0}
        pr={[48, 84]}
        pl={[32, 40]}
        autoFocus
        data-lpignore
      />
    </Flex>
      <ul>
      {links.items.map(link => (
          <li key={link.address}><a href={link.target}>/{link.address}</a> {link.description}</li>
        ))}
      </ul>
  </Col>
  );
};

export default SearchBar;
