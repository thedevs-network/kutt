"use client"

import { StoreProvider } from "easy-peasy";
import { initializeStore } from './store';
import { useState, useEffect } from "react";
import PageLoading from '../components/PageLoading';

export function Providers({ children }: { children: React.ReactNode }) {
    const store = initializeStore();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (typeof window !== "undefined") {
          setLoading(false);
        }
      }, [])    

    if(loading) return (
        <StoreProvider store={store}>
            <PageLoading />
        </StoreProvider>
        )

    return (
        <StoreProvider store={store}>
            {children}
        </StoreProvider>
    );
}
