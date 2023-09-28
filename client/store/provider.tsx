"use client"

import { StoreProvider } from "easy-peasy";
import { initializeStore } from './store';

export function Providers({ children }: { children: React.ReactNode }) {
    const store = initializeStore();

    return (
        <StoreProvider store={store}>
            {children}
        </StoreProvider>
    );
}
