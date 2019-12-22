import "next";
import { initializeStore } from "./store";

declare global {
  interface Window {
    GA_INITIALIZED: boolean;
  }
}

declare module "next" {
  export interface NextPageContext {
    store: ReturnType<typeof initializeStore>;
  }
}
