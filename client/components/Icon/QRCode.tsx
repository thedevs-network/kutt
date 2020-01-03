import React from "react";

function QRCOde() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      fill="currentColor"
      className="jam jam-qr-code"
      preserveAspectRatio="xMinYMin"
      viewBox="-2 -2 24 24"
    >
      <path d="M13 18h3a2 2 0 002-2v-3a1 1 0 012 0v3a4 4 0 01-4 4H4a4 4 0 01-4-4v-3a1 1 0 012 0v3a2 2 0 002 2h3a1 1 0 010 2h6a1 1 0 010-2zM2 7a1 1 0 11-2 0V4a4 4 0 014-4h3a1 1 0 110 2H4a2 2 0 00-2 2v3zm16 0V4a2 2 0 00-2-2h-3a1 1 0 010-2h3a4 4 0 014 4v3a1 1 0 01-2 0z"></path>
    </svg>
  );
}

export default React.memo(QRCOde);
