import React, { FC, useState } from "react";
import Router from "next/router";
import styled from "styled-components";
import URL from "url";
import QRCode from "qrcode.react";
import { Flex } from "reflexbox/styled-components";

import TBodyButton from "./TBodyButton";
import Modal from "../../Modal";

interface Props {
  showModal: any;
  url: {
    count: number;
    domain: string;
    id: string;
    password: boolean;
    shortLink: string;
    visit_count: number;
  };
}

const Actions = styled(Flex).attrs({
  justifyContent: "center",
  alignItems: "center"
})`
  button {
    margin: 0 2px 0 12px;
  }
`;

const Icon = styled.img`
  width: 12px;
  height: 12px;
`;

const TBodyCount: FC<Props> = ({ url }) => {
  const [showModal, setShowModal] = useState(false);
  const toggleQrCodeModal = () => setShowModal(current => !current);

  function goTo(e) {
    e.preventDefault();
    const { id, domain } = url;
    Router.push(`/stats?id=${id}${domain ? `&domain=${domain}` : ""}`);
  }

  const showQrCode = window.innerWidth > 640;

  return (
    <Flex flex="1 1 auto" justifyContent="space-between" alignItems="center">
      {url.visit_count || 0}
      <Actions>
        {url.password && <Icon src="/images/lock.svg" />}
        {url.visit_count > 0 && (
          <TBodyButton withText onClick={goTo}>
            <Icon src="/images/chart.svg" />
            Stats
          </TBodyButton>
        )}
        {showQrCode && (
          <TBodyButton onClick={toggleQrCodeModal}>
            <Icon src="/images/qrcode.svg" />
          </TBodyButton>
        )}
        <TBodyButton
          data-id={url.id}
          data-host={URL.parse(url.shortLink).hostname}
          onClick={toggleQrCodeModal} // FIXME: what does this do?
        >
          <Icon src="/images/trash.svg" />
        </TBodyButton>
      </Actions>
      <Modal show={showModal}>
        <QRCode value={url.shortLink} size={196} />
      </Modal>
    </Flex>
  );
};

export default TBodyCount;
