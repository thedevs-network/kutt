
import React, { useEffect, useCallback } from "react";
import { useFormState } from "react-use-form-state";
import { Flex } from "reflexbox/styled-components";
import debounce from 'debounce'

import { useStoreActions, useStoreState } from "../store";
import { TextInput } from "./Input";
import { Col } from "./Layout";
import { H2 } from "../components/Text";

interface Form {
  all: boolean;
  limit: string;
  skip: string;
  search: string;
  searchable: boolean;
}

const FORM_PARAMS = {
  skip: "0",
  limit: "10",
  all: false,
  searchable: true
}

const FORM_OPTIONS = {
  withIds: true
}

const SearchBar = () => {
  const links = useStoreState(s => s.links);
  const get = useStoreActions(s => s.links.get);
  const reset = useStoreActions(s => s.links.reset)
  const [formState, { text }] = useFormState<Form>(
    FORM_PARAMS,
    FORM_OPTIONS
  );
  const debouncedGet = useCallback(debounce(get, 500), [get]);

  useEffect(() => {
    if (formState.values.search.length === 0) {
      reset();
    } else {
      debouncedGet(formState.values);
      return debouncedGet.clear;
    }
  }, [formState.values?.search]);

  return (
    <Col width={800} maxWidth="100%" px={[3]} flex="0 0 auto" mt={4}>
      <Flex
        as="form"
        id="shortenerform"
        width={1}
        alignItems="center"
        justifyContent="center"
        style={{ position: "relative" }}
      >
        <H2 my={4} light >
          {process.env.SITE_NAME}/
        </H2>
        <TextInput
          {...text("search")}
          placeholder="Search your url"
          autoComplete="off"
          placeholderSize={[16, 17, 18]}
          fontSize={[18, 20, 22]}
          height={[58, 64, 72]}
          width={[400, 500, 700]}
          style={{ marginLeft: "5px" }}
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
