import React from "react";
import styled from "styled-components";
import { Flex } from "reflexbox/styled-components";

import FeaturesItem from "./FeaturesItem";
import { ColCenterH } from "./Layout";
import { Colors } from "../consts";
import Text, { H3 } from "./Text";
import { useTranslation } from 'react-i18next';

const Features = () => {
  const { t, i18n } = useTranslation();
  return (
    <ColCenterH
      width={1}
      flex="0 0 auto"
      py={[64, 100]}
      backgroundColor={Colors.FeaturesBg}
    >
      <H3 fontSize={[26, 28]} mb={72} light>
        {t('feature.title')}
    </H3>
      <Flex
        width={1200}
        maxWidth="100%"
        flex="1 1 auto"
        justifyContent="center"
        flexWrap={["wrap", "wrap", "wrap", "nowrap"]}
      >
        <FeaturesItem title={t('feature.f1.title')} icon="edit">
        {t('feature.f1.description')}
      </FeaturesItem>
        <FeaturesItem title={t('feature.f2.title')} icon="shuffle">
        {t('feature.f2.description')}
      </FeaturesItem>
        <FeaturesItem title={t('feature.f3.title')} icon="zap">
        {t('feature.f3.description')}
      </FeaturesItem>
        <FeaturesItem title={t('feature.f4.title')} icon="heart">
        {t('feature.f4.description')}
      </FeaturesItem>
      </Flex>
    </ColCenterH>
  );
}

export default Features;
