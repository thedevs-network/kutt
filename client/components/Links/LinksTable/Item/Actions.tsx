
import React, { useState } from "react";
import styled from "styled-components";
import getConfig from "next/config";
import Link from "next/link";
import { useStoreState } from "../../../../store";
import { Link as LinkType } from "../../../../store/links";
import Tooltip from "../../../Tooltip";
import ALink from "../../../ALink";
import BanModal from "../../Modal/BanModal"
import QRCodeModal from "../../Modal/QRCodeModal"
import Action from "./Action"
import { Td } from "../../../Table";

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
  const [banModal, setBanModal] = useState(false);

  const isAdmin = useStoreState(s => s.auth.isAdmin);

  const [qrModal, setQRModal] = useState(false);


  return (
    <>
      <Td {...actionsFlex} justifyContent="flex-end">
        {link.password && (
          <>
            <Tooltip id={`${index}-tooltip-password`}>
              Password protected
            </Tooltip>
            <Action
              as="span"
              data-tip
              data-for={`${index}-tooltip-password`}
              name="key"
              stroke="hsl(0, 0%, 73%)"
              strokeWidth="2.5"
              backgroundColor="transparent"
            />
          </>
        )}
        {link.banned && (
          <>
            <Tooltip id={`${index}-tooltip-banned`}>Banned</Tooltip>
            <Action
              as="span"
              data-tip
              data-for={`${index}-tooltip-banned`}
              name="stop"
              stroke="hsl(0, 0%, 73%)"
              strokeWidth="2.5"
              backgroundColor="transparent"
            />
          </>
        )}
        {link.visit_count > 0 && (
          <Link href={`/stats?id=${link.id}`}>
            <PieALink title="View stats" forButton>
              <Action
                name="pieChart"
                strokeWidth="2.5"
                stroke="hsl(260, 100%, 69%)"
                backgroundColor="hsl(260, 100%, 96%)"

              />
            </PieALink>
          </Link>
        )}
        <Action
          name="qrcode"
          stroke="none"
          fill="hsl(0, 0%, 35%)"
          backgroundColor="hsl(0, 0%, 94%)"
          onClick={() => setQRModal(true)}
        />
        <Action
          name="editAlt"
          strokeWidth="2.5"
          stroke="hsl(46, 90%, 50%)"
          backgroundColor="hsl(46, 100%, 94%)"
          onClick={() => setShowEdit(s => !s)}
        />

        {isAdmin && !link.banned && (
          <Action
            name="stop"
            strokeWidth="2"
            stroke="hsl(10, 100%, 40%)"
            backgroundColor="hsl(10, 100%, 96%)"
            onClick={() => setBanModal(true)}
          />
        )}
        <Action
          mr={0}
          name="trash"
          strokeWidth="2"
          stroke="hsl(0, 100%, 69%)"
          backgroundColor="hsl(0, 100%, 96%)"
          onClick={() => setDeleteModal(index)}
        />
      </Td>

      <QRCodeModal link={link} showModal={qrModal} closeModal={setQRModal} />
      <BanModal link={link} showModal={banModal} closeModal={setBanModal} />
    </>
  );
};

export default Actions