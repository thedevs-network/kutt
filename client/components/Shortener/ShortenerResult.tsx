import React, { FC, useState } from 'react';
import styled from 'styled-components';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import QRCode from 'qrcode.react';
import { Flex } from 'reflexbox/styled-components';

import Button from '../Button';
import Loading from '../PageLoading';
import { fadeIn } from '../../helpers/animations';
import TBodyButton from '../Table/TBody/TBodyButton';
import Modal from '../Modal';

// TODO: types
interface Props {
  copyHandler: any;
  isCopied: boolean;
  loading: boolean;
  url: {
    list: any[];
  };
}

const Wrapper = styled(Flex).attrs({
  justifyContent: 'center',
  alignItems: 'center',
})`
  position: relative;

  button {
    margin-left: 24px;
  }
`;

const Url = styled.h2`
  margin: 8px 0;
  font-size: 32px;
  font-weight: 300;
  border-bottom: 2px dotted #aaa;
  cursor: pointer;
  transition: all 0.2s ease;

  :hover {
    opacity: 0.5;
  }

  @media only screen and (max-width: 448px) {
    font-size: 24px;
  }
`;

const CopyMessage = styled.p`
  position: absolute;
  top: -32px;
  left: 0;
  font-size: 14px;
  color: #689f38;
  animation: ${fadeIn} 0.3s ease-out;
`;

const QRButton = styled(TBodyButton)`
  width: 36px;
  height: 36px;
  margin-left: 12px !important;
  box-shadow: 0 4px 10px rgba(100, 100, 100, 0.2);

  :hover {
    box-shadow: 0 4px 10px rgba(100, 100, 100, 0.3);
  }

  @media only screen and (max-width: 768px) {
    height: 32px;
    width: 32px;

    img {
      width: 14px;
      height: 14px;
    }
  }
`;

const Icon = styled.img`
  width: 16px;
  height: 16px;
`;

const ShortenerResult: FC<Props> = ({
  copyHandler,
  isCopied,
  loading,
  url,
}) => {
  const [qrModal, setQrModal] = useState(false);
  const toggleQrCodeModal = () => setQrModal(current => !current);

  const showQrCode = window.innerWidth > 420;

  if (loading) return <Loading />;

  return (
    <Wrapper>
      {isCopied && <CopyMessage>Copied to clipboard.</CopyMessage>}
      <CopyToClipboard text={url.list[0].shortLink} onCopy={copyHandler}>
        <Url>{url.list[0].shortLink.replace(/^https?:\/\//, '')}</Url>
      </CopyToClipboard>
      <CopyToClipboard text={url.list[0].shortLink} onCopy={copyHandler}>
        <Button icon="copy">Copy</Button>
      </CopyToClipboard>
      {showQrCode && (
        <QRButton onClick={toggleQrCodeModal}>
          <Icon src="/images/qrcode.svg" />
        </QRButton>
      )}
      <Modal show={qrModal} close={toggleQrCodeModal}>
        <QRCode value={url.list[0].shortLink} size={196} />
      </Modal>
    </Wrapper>
  );
};

export default ShortenerResult;
