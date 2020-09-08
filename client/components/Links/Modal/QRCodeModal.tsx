
import React from "react";
import QRCode from "qrcode.react";

import { Link as LinkType } from "../../../store/links";
import Modal from "../../Modal";
import { RowCenter } from "../../Layout";

type Props = {
  link: LinkType;
  showModal: boolean;
  closeModal: Function;
}

const QRCodeLink = ({
  link,
  showModal,
  closeModal
}: Props) => {

  return (
    <Modal
      id="table-qrcode-modal"
      minWidth="max-content"
      show={showModal}
      closeHandler={() => closeModal(false)}
    >
      <RowCenter width={192}>
        <QRCode size={192} value={link.link} />
      </RowCenter>
    </Modal>
  )
}
export default QRCodeLink;