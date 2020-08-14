
import React, { FC, useState, useEffect, useCallback } from "react";
import { useFormState } from "react-use-form-state";
import debounce from 'debounce'

import { useStoreActions } from "../../store";
import { Col } from "../Layout";
import  { H2 } from "../Text";
import {Table} from "../Table";
import { useTranslation } from 'react-i18next';
import LinksTable from "./LinksTable/LinksTable"
import Footer from "./Footer";
import Header from "./Header";

interface Form {
  all: boolean;
  limit: string;
  skip: string;
  search: string;
  searchable: boolean;
}

const Links: FC = () => {
  const { t } = useTranslation();
  const { get } = useStoreActions(s => s.links);
  const [tableMessage, setTableMessage] = useState("No links to show.");
  const [formState, { text }] = useFormState<Form>(
    { skip: '0', limit: '10', all: false, searchable: false },
    { withIds: true }
  );

  const getLinks = useCallback((formValues) =>
    get({
      ...formValues,
      skip: parseInt(formValues.skip, 10),
      limit: parseInt(formValues.limit, 10)
    })
  , [get])
  const onLimitChange = useCallback((limit: number) => formState.setField("limit", `${limit}`), [formState])
  const onSkipChange = useCallback((skip: number) => formState.setField("skip", `${skip}`), [formState])
  const onAllChange = useCallback((all: boolean) => formState.setField("all", all), [formState])
 
  const onRemove = useCallback(() => getLinks(formState.values), [formState])

  const debouncedGet = useCallback(debounce(getLinks, 500), [getLinks]);

  // dumb component should be agnostic from form library

  useEffect(() => {
    debouncedGet(formState.values)
  }, [formState.values.search]);

  useEffect(() => {
    getLinks(formState.values).catch(err =>
      setTableMessage(err?.response?.data?.error || "An error occurred.")
    );
  }, [formState.values.all, formState.values.skip, formState.values.limit ]);

  const searchProps = text("search")
  return (
    <Col width={1200} maxWidth="95%" margin="40px 0 120px" my={6}>
      <H2 mb={3} light>
        {t('linksTable.title')}
      </H2>
      <Table scrollWidth="800px">
        <Header
          limit={parseInt(formState.values.limit, 10)}
          onLimitChange={onLimitChange}
          skip={parseInt(formState.values.skip, 10)}
          onSkipChange={onSkipChange}
          search={searchProps.value} 
          onSearchChange={searchProps.onChange}
          all={formState.values.all}
          onAllChange={onAllChange}
           />
        <LinksTable onRemove={onRemove} tableMessage={tableMessage} />
        <Footer
          onLimitChange={onLimitChange}
          limit={parseInt(formState.values.limit, 10)}
          onSkipChange={onSkipChange}
          skip={parseInt(formState.values.skip, 10)}/>
      </Table>
    </Col>
  );
};

export default Links;
