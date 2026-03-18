'use client';

import React, { createContext, useContext } from 'react';
import { useOrganizations } from '@/lib/hooks';

type OrganizationContextValue = ReturnType<typeof useOrganizations>;

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
    const organizationsState = useOrganizations();

    return (
        <OrganizationContext.Provider value={organizationsState}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganizationContext() {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error('useOrganizationContext must be used within an OrganizationProvider');
    }

    return context;
}
