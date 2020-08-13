
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
  const [formState, { label, checkbox, text }] = useFormState<Form>(// TOCHECk utile de garder ça ?
    { skip: "0", limit: "10", all: false, searchable: false },
    { withIds: true }
  );

  const onLimitChange = useCallback((limit: string) => formState.setField("limit", limit), [formState])
  const onSkipChange = useCallback((skip: string) => formState.setField("skip", skip), [formState])
  const onSearchSubmit = useCallback((search: string) => formState.setField("search", search), [formState])
  const onAllChange = useCallback((all: boolean) => formState.setField("all", all), [formState])
 
  const onRemove = useCallback(() => get(formState.values), [formState])

  const debouncedGet = useCallback(debounce(get, 500), [get]);

  useEffect(() => {
    debouncedGet(formState.values)
  }, [formState.values.search]);

  useEffect(() => {
    get(formState.values).catch(err =>
      setTableMessage(err?.response?.data?.error || "An error occurred.")
    );
  }, [formState.values.all, formState.values.skip, formState.values.limit ]);


  return (
    <Col width={1200} maxWidth="95%" margin="40px 0 120px" my={6}>
      <H2 mb={3} light>
        {t('linksTable.title')}
      </H2>
      <Table scrollWidth="800px">
        <Header
          onLimitChange={onLimitChange}
          limit={formState.values.limit}
          onSkipChange={onSkipChange}
          skip={formState.values.skip}
          onSearchSubmit={onSearchSubmit}
          text={text}// TOCHECK 
          onAllChange={onAllChange}
          all={formState.values.all}
           />
        <LinksTable onRemove={onRemove} tableMessage={tableMessage} />
        <Footer
          onLimitChange={onLimitChange}
          limit={formState.values.limit}
          onSkipChange={onSkipChange}
          skip={formState.values.skip}/>
      </Table>
    </Col>
  );
};

export default Links;
