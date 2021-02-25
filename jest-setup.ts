import "@testing-library/jest-dom";
import nextConfig from "./next.config";

jest.mock('next/config', () => () => nextConfig);

