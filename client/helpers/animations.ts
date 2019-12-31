import { keyframes } from "styled-components";

export const fadeInVertical = vertical => keyframes`
  from {
    opacity: 0;
    transform: translateY(${vertical});
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const spin = keyframes`
  from {
    transform: rotate(0);
  }
  to {
    transform: rotate(-360deg);
  }
`;
