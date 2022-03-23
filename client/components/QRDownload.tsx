import styled, { css } from "styled-components";

//downloadable QR code show arrow on hover
const QRDownload = styled.a`
    position: relative;
    cursor: pointer;

    span {
        position: absolute;
        display: block;
        color: #fff;
        background: #2f83fd;
        opacity: 0;
        left: 0;
        right: 0;
        margin: auto;
        text-align: center;
        padding: 5px 10px;
        width: 30px;
        height: 40px;
        vertical-align: middle;
        line-height: 42px;
        font-size: 30px;
        box-shadow: 0 0 5px rgb(0 0 0 / 60%);
        border-radius: 60px;
        top: 30%;
    }

    &:hover span {
        opacity: 1;
        top: 38%;
        transition: top 200ms, opacity 200ms;
    }
`;

export default QRDownload;
