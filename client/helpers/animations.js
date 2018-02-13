import { keyframes } from 'styled-components';

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
