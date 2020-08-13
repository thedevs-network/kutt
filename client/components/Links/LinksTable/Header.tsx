
import React  from "react";
import { useTranslation } from 'react-i18next';
import {Tr, Th} from "../../Table";

const ogLinkFlex = { flexGrow: [1, 3, 7], flexShrink: [1, 3, 7] };
const createdFlex = { flexGrow: [1, 1, 2.5], flexShrink: [1, 1, 2.5] };
const shortLinkFlex = { flexGrow: [1, 1, 3], flexShrink: [1, 1, 3] };
const viewsFlex = {
  flexGrow: [0.5, 0.5, 1],
  flexShrink: [0.5, 0.5, 1],
  justifyContent: "flex-end"
};
const actionsFlex = { flexGrow: [1, 1, 3], flexShrink: [0, 0, 0] };

const Header = () => {
  const { t } = useTranslation();
    return(
      <Tr>
        <Th {...ogLinkFlex}>{t('linksTable.table.originalURL')}</Th>
        <Th {...createdFlex}>{t('linksTable.table.created')}</Th>
        <Th {...shortLinkFlex}>{t('linksTable.table.shortURL')} </Th>
        <Th {...viewsFlex}>{t('linksTable.table.views')}</Th>
        <Th {...actionsFlex}></Th>
      </Tr>
    )
}
export default Header;