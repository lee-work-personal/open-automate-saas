'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    collection,
    doc,
    getDoc,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db, useAuth } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/constants';
import { ensurePersonalOrganization, getPersonalOrganizationId, slugifyOrgName, type Organization } from '@/lib/tenancy';

export interface OrganizationRecord extends Organization {
    plan?: 'free' | 'pro' | 'enterprise';
    billingStatus?: 'trial' | 'active' | 'past_due' | 'cancelled';
    trialEndsAt?: unknown;
}

export function useOrganizations() {
    const { user } = useAuth();
    const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
    const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        if (!user) {
            setOrganizations([]);
            setActiveOrganizationId(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        const organizationMap = new Map<string, OrganizationRecord>();

        const syncUser = async () => {
            await ensurePersonalOrganization(db, user);
        };

        void syncUser();

        const commitOrganizations = () => {
            if (cancelled) return;

            const records = Array.from(organizationMap.values()).sort((a, b) => a.name.localeCompare(b.name));
            setOrganizations(records);

            if (!activeOrganizationId && records.length > 0) {
                setActiveOrganizationId(records[0].id);
            } else if (activeOrganizationId && !organizationMap.has(activeOrganizationId) && records.length > 0) {
                setActiveOrganizationId(records[0].id);
            }

            setLoading(false);
        };

        const unsubscribers = [
            onSnapshot(doc(db, COLLECTIONS.USERS, user.uid), (snapshot) => {
                const userData = snapshot.data();
                if (userData?.defaultOrganizationId) {
                    setActiveOrganizationId(userData.defaultOrganizationId);
                } else if (!cancelled) {
                    setActiveOrganizationId(getPersonalOrganizationId(user.uid));
                }
            }),
            onSnapshot(
                query(collection(db, COLLECTIONS.ORGANIZATIONS), where('ownerId', '==', user.uid)),
                (snapshot) => {
                    snapshot.forEach((organizationDoc) => {
                        organizationMap.set(organizationDoc.id, {
                            id: organizationDoc.id,
                            ...organizationDoc.data(),
                        } as OrganizationRecord);
                    });
                    commitOrganizations();
                }
            ),
            onSnapshot(
                query(collection(db, COLLECTIONS.ORGANIZATIONS), where('members', 'array-contains', user.uid)),
                (snapshot) => {
                    snapshot.forEach((organizationDoc) => {
                        organizationMap.set(organizationDoc.id, {
                            id: organizationDoc.id,
                            ...organizationDoc.data(),
                        } as OrganizationRecord);
                    });
                    commitOrganizations();
                }
            ),
        ];

        return () => {
            cancelled = true;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [user]);

    const switchOrganization = useCallback(async (organizationId: string) => {
        if (!user) return;

        setSwitching(true);
        try {
            await updateDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                defaultOrganizationId: organizationId,
                updatedAt: serverTimestamp(),
            });
            setActiveOrganizationId(organizationId);
        } finally {
            setSwitching(false);
        }
    }, [user]);

    const createOrganization = useCallback(async (input: { name: string; slug?: string }) => {
        if (!user) {
            throw new Error('Not authenticated');
        }

        const organizationRef = doc(collection(db, COLLECTIONS.ORGANIZATIONS));
        const organizationId = organizationRef.id;
        const userRef = doc(db, COLLECTIONS.USERS, user.uid);
        const userSnap = await getDoc(userRef);
        const existingUserData = userSnap.exists() ? userSnap.data() : {};

        await setDoc(organizationRef, {
            name: input.name,
            slug: input.slug || slugifyOrgName(input.name),
            ownerId: user.uid,
            members: [user.uid],
            plan: 'free',
            billingStatus: 'trial',
            trialEndsAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        await setDoc(userRef, {
            defaultOrganizationId: organizationId,
            organizationIds: Array.from(new Set([...(existingUserData.organizationIds || []), organizationId])),
            updatedAt: serverTimestamp(),
        }, { merge: true });

        setActiveOrganizationId(organizationId);
        return organizationId;
    }, [user]);

    const updateOrganization = useCallback(async (organizationId: string, input: { name?: string; slug?: string }) => {
        if (!user) {
            throw new Error('Not authenticated');
        }

        const updateData: Record<string, unknown> = {
            updatedAt: serverTimestamp(),
        };

        if (input.name !== undefined) {
            updateData.name = input.name.trim();
        }

        if (input.slug !== undefined) {
            updateData.slug = slugifyOrgName(input.slug);
        }

        await updateDoc(doc(db, COLLECTIONS.ORGANIZATIONS, organizationId), updateData);
    }, [user]);

    const activeOrganization = useMemo(
        () => organizations.find((organization) => organization.id === activeOrganizationId) || null,
        [organizations, activeOrganizationId]
    );

    return {
        organizations,
        activeOrganization,
        activeOrganizationId,
        loading,
        switching,
        switchOrganization,
        createOrganization,
        updateOrganization,
    };
}
