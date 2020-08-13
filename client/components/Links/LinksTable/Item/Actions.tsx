
import React, { useState } from "react";
import styled from "styled-components";
import getConfig from "next/config";
import Link from "next/link";
import { useTranslation } from 'react-i18next';

import { useTheme } from "../../../../hooks";
import { useStoreState } from "../../../../store";
import { Link as LinkType } from "../../../../store/links";
import Tooltip from "../../../Tooltip";
import ALink from "../../../ALink";
import BanModal from "../../Modal/BanModal"
import QRCodeModal from "../../Modal/QRCodeModal"
import Action from "./Action"
import { Td} from "../../../Table";

const { publicRuntimeConfig } = getConfig();

const PieALink = styled(ALink)`
  flex-shrink: 0;
  padding-bottom: 0px;
  border-bottom-width: 0px;
`
const actionsFlex = { flexGrow: [1, 1, 3], flexShrink: [0, 0, 0] };

type Props = {
  index: number;
  link: LinkType;
  setDeleteModal: (number) => void;
  setShowEdit: (boolean) => void;
}


const Actions = ({
  index,
  link,
  setDeleteModal,
  setShowEdit
}: Props) => {
  const theme = useTheme()
  const { t } = useTranslation();
  const [banModal, setBanModal] = useState(false);

  const isAdmin = useStoreState(s => s.auth.isAdmin);

  const [qrModal, setQRModal] = useState(false);


  return (
    <>
      <Td {...actionsFlex} justifyContent="flex-end">
        {link.password && (
          <>
            <Tooltip id={`${index}-tooltip-password`}>
              {t('linksTable.tooltip.passwordProtected')}
            </Tooltip>
            <Action
              as="span"
              data-tip
              data-for={`${index}-tooltip-password`}
              name="key"
              stroke={theme.icon.activate.main}
              strokeWidth="2.5"
              backgroundColor={theme.icon.activate.bg}
            />
          </>
        )}
        {link.banned && (
          <>
            <Tooltip id={`${index}-tooltip-banned`}>{t('linksTable.tooltip.banned')}</Tooltip>
            <Action
              as="span"
              data-tip
              data-for={`${index}-tooltip-banned`}
              name="stop"
              stroke={theme.icon.activate.main}
              strokeWidth="2.5"
              backgroundColor={theme.icon.activate.bg}
            />
          </>
        )}
        {publicRuntimeConfig.SEARCH_ENABLED && link.searchable && (
          <>
            <Tooltip id={`${index}-tooltip-searchable`}>
              {t('linksTable.table.chSearchable')}
            </Tooltip>
            <Action
              as="span"
              data-tip
              data-for={`${index}-tooltip-searchable`}
              name="eye"
              color={theme.icon.activate.main}
              strokeWidth="2"
              backgroundColor={theme.icon.activate.bg}
            />
          </>
        )}
        {link.visit_count > 0 && (
          <Link href={`/stats?id=${link.id}`}>
            <PieALink title={t('linksTable.tooltip.stat')} forButton>
              <Action
                name="pieChart"
                strokeWidth="2.5"
                stroke={theme.icon.pie.main}
                backgroundColor={theme.icon.pie.bg}

              />
            </PieALink>
          </Link>
        )}
        <Action
          name="qrcode"
          stroke="none"
          fill={theme.icon.qrCode.main}
          backgroundColor={theme.icon.qrCode.bg}
          onClick={() => setQRModal(true)}
        />
        <Action
          name="editAlt"
          strokeWidth="2.5"
          stroke={theme.icon.edit.main}
          backgroundColor={theme.icon.edit.bg}
          onClick={() => setShowEdit(s => !s)}
        />

        {isAdmin && !link.banned && (
          <Action
            name="stop"
            strokeWidth="2"
            stroke={theme.icon.stop.main}
            backgroundColor={theme.icon.stop.bg}
            onClick={() => setBanModal(true)}
          />
        )}
        <Action
          mr={0}
          name="trash"
          strokeWidth="2"
          stroke={theme.icon.trash.main}
          backgroundColor={theme.icon.trash.bg}
          onClick={() => setDeleteModal(index)}
        />
      </Td>

      <QRCodeModal link={link} showModal={qrModal} closeModal={setQRModal} />
      <BanModal link={link} showModal={banModal} closeModal={setBanModal} />
    </>
  );
};

export default Actions