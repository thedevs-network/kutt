import React from "react";
import AppWrapper from "../components/AppWrapper";
import  { H2 } from "../components/Text";
import { useTranslation } from 'react-i18next';


const custom404 = () => {
  const { t} = useTranslation();
  return (
    <AppWrapper>
        <H2 my={4} light>
          {t('error.404')}
        </H2>
    </AppWrapper>
  );
};

export default custom404;
