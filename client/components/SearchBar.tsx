
import React, { useState, useEffect, useCallback } from "react";
import { useFormState } from "react-use-form-state";
import { Flex, BoxProps} from "reflexbox/styled-components";
import debounce from 'debounce'

import styled  from "styled-components";
import {  prop, ifProp} from "styled-tools";
import { useStoreActions, useStoreState } from "../store";
import { Col } from "./Layout";
import Text, { H2 } from "../components/Text";
import ALink from "./ALink";
import { TextInput } from "./Input";
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
interface ContainerProps extends BoxProps {
  notEmpty?: boolean;
}
const Container = styled(Col)<ContainerProps>`
  margin-left: 10px;
  margin-top: 10px;
  background-color: white;
  box-sizing: border-box;
  position: relative;
  box-shadow: 0 10px 35px hsla(200, 15%, 70%, 0.2);
  border: none;
  border-radius: ${prop("br", "30px")};
  border-bottom: 5px solid #f5f5f5;
  ${ifProp("notEmpty", `padding-bottom: 18px;`)}  
  border-bottom-width: ${prop("bbw", "5px")};
  transition: all 0.5s ease-out;

  @media screen and (min-width: 52em) {
    letter-spacing: 0.1em;
    border-bottom-width: ${prop("bbw", "6px")};
  }

￼`

interface LinksContainerProps extends BoxProps {
  selected?: boolean;
}

const LinksContainer = styled(Flex)<LinksContainerProps>`
  box-sizing: border-box;
  position: relative;
  letter-spacing: 0.05em;
  background-color: white;
  color: #444; 
  border: none;
  border-top: 1px solid hsl(200, 14%, 90%);
  transition: all 0.5s ease-out;
  :hover { 
    background-color: #E7E7E7;
  };

  ${ifProp(
    "selected",
    `
      background-color: #DADBDB;
      box-shadow: 0 0px 2px rgba(150, 150, 150, 0.1);
      cursor: default;
      :hover {
        transform: none;
      }
    `
  )}
￼`

const LinkTarget = styled(ALink)`
  border-bottom: none;
  margin-left: 15px;
  margin-top: 4px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden; 
`

const SearchBar = () => {
  const links = useStoreState(s => s.links);
  const [position, setPosition] = useState<number>(0)
  const [selected, setSelected] = useState<string>()
  const get = useStoreActions(s => s.links.get);
  const reset = useStoreActions(s => s.links.reset)
  const [formState, { text }] = useFormState<Form>(
    FORM_PARAMS,
    FORM_OPTIONS
  );

  const debouncedGet = useCallback(debounce(get, 300), [get]);

  useEffect(() => {
    if (formState.values.search.length === 0) {
      reset();
    } else {
      debouncedGet(formState.values);
    }
  }, [formState.values?.search]);
  
  //reset link selected by the first link
  useEffect(() => {
    if (links.items[0] !== undefined) {
      setSelected(links.items[0].id)
    }
    setPosition(0)
  }, [get, links])

  //updates link selected
  useEffect(() => {
    if (links.items[position] !== undefined) {
      setSelected(links.items[position].id)
    }
  }, [position])

  const handleUserKeyPress = event => {
    const { key } = event;
    if (links.items.length != 0) {
      switch (key) {
        case "Enter":
          window.location.replace(links.items[position].target);
          break;
        case "ArrowUp":
          setPosition(position == 0 ? links.items.length - 1 : (position - 1))
          break;
        case "ArrowDown":
          setPosition((position >= (links.items.length - 1)) ? 0 : (position + 1))
          break;
      }
    }
  };
  useEffect(() => {
    window.addEventListener('keyup', handleUserKeyPress);
    return () => {
      window.removeEventListener('keyup', handleUserKeyPress);
    };
  }, [handleUserKeyPress]);

  

  return (
    <Col width={800} maxWidth="100%" px={[3]} flex="0 0 auto" mt={4}>
      <Flex
        id="shortenerform"
        width={1}
        alignItems="start"
        justifyContent="center"
        style={{ position: "relative" }}
      >
        <H2 my={4} light >
          {process.env.SITE_NAME}/
        </H2>
        <Container 
            width={[400, 500, 650]}
            notEmpty= {links.items.length>0}
            data-lpignore>
          <TextInput
            {...text("search")}
            placeholder="Search your url"
            autoComplete="off"
            placeholderSize={[16, 17, 18]}
            fontSize={[18, 20, 22]}
            height={[52, 58, 64]}
            width={[400, 500, 650]}
            br="30px"
            bbw="0px"
            px={0}
            pr={[20, 25]}
            pl={[20, 25]}
            autoFocus
            data-lpignore
            shadow={false}
          />
          {links.items.map(link => (
            <LinksContainer selected = {link.id === selected } 
            fontSize={[14, 16, 18]}
            height={(link.id === selected) ? 1: [40,45,50]}
            minHeight= {[40,45,50]}
            pr={[15, 20]}
            pl={[15, 20]}>
              <Col alignItems="flex-start" >
                
                <Flex>
                  <ALink href={link.target} >go/{link.address}</ALink>
                  <LinkTarget href={link.target} 
                    fontSize={[13, 14]}
                    width={[200, 300, 400]}>
                      ({link.target})
                    </LinkTarget>
                  </Flex>
                
                {link.description && (
                  <Text fontSize={[13, 14]} color="#888">
                    {link.description}

                  </Text>
                )}
              </Col></LinksContainer>
          ))}
        </Container>
      </Flex>
    </Col>
  );
};

export default SearchBar;
