'use client';

import type { User } from 'firebase/auth';
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    updateDoc,
    type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from './constants';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    ownerId: string;
    members: string[];
    createdAt?: unknown;
    updatedAt?: unknown;
}

export function getPersonalOrganizationId(userId: string) {
    return `personal-${userId}`;
}

export function slugifyOrgName(name: string) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50) || 'workspace';
}

export async function ensurePersonalOrganization(db: Firestore, user: Pick<User, 'uid' | 'email' | 'displayName'>) {
    const organizationId = getPersonalOrganizationId(user.uid);
    const organizationRef = doc(db, COLLECTIONS.ORGANIZATIONS, organizationId);
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);

    const [organizationSnap, userSnap] = await Promise.all([
        getDoc(organizationRef),
        getDoc(userRef),
    ]);

    const organizationName =
        user.displayName?.trim() ||
        user.email?.split('@')[0] ||
        'Personal Workspace';

    if (!organizationSnap.exists()) {
        await setDoc(organizationRef, {
            name: `${organizationName}'s Workspace`,
            slug: slugifyOrgName(`${organizationName}-${user.uid.slice(0, 6)}`),
            ownerId: user.uid,
            members: [user.uid],
            plan: 'free',
            billingStatus: 'trial',
            trialEndsAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }

    const existingUserData = userSnap.exists() ? userSnap.data() : {};
    await setDoc(
        userRef,
        {
            defaultOrganizationId: existingUserData.defaultOrganizationId || organizationId,
            organizationIds: Array.from(new Set([...(existingUserData.organizationIds || []), organizationId])),
            updatedAt: serverTimestamp(),
        },
        { merge: true }
    );

    return organizationId;
}

export async function getDefaultOrganizationId(db: Firestore, userId: string) {
    const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, userId));
    const defaultOrganizationId = userSnap.data()?.defaultOrganizationId;
    if (defaultOrganizationId) {
        return defaultOrganizationId as string;
    }

    return getPersonalOrganizationId(userId);
}
