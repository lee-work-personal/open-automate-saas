'use client';

/**
 * Firestore Hooks for Test Suites
 */

import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    doc,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    Timestamp,
    writeBatch,
    getDoc,
} from 'firebase/firestore';
import { db, useAuth } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/constants';

// Types
export interface TestSuite {
    id: string;
    organizationId: string;
    projectId: string;
    name: string;
    description?: string;
    tags: string[];
    parentSuiteId?: string;
    order: number;
    createdBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface CreateTestSuiteInput {
    projectId: string;
    name: string;
    description?: string;
    tags?: string[];
    parentSuiteId?: string;
}

export interface UpdateTestSuiteInput {
    name?: string;
    description?: string;
    tags?: string[];
    parentSuiteId?: string;
    order?: number;
}

/**
 * Hook to fetch all test suites for a project
 */
export function useTestSuites(projectId: string | null) {
    const [suites, setSuites] = useState<TestSuite[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!projectId) {
            setSuites([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const q = query(
            collection(db, COLLECTIONS.TEST_SUITES),
            where('projectId', '==', projectId)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const suiteList: TestSuite[] = [];
                snapshot.forEach((doc) => {
                    suiteList.push({ id: doc.id, ...doc.data() } as TestSuite);
                });
                // Sort client-side to avoid composite index requirement
                suiteList.sort((a, b) => a.order - b.order);
                setSuites(suiteList);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching test suites:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [projectId]);

    return { suites, loading, error };
}

/**
 * Hook to fetch a single test suite
 */
export function useTestSuite(suiteId: string | null) {
    const [suite, setSuite] = useState<TestSuite | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!suiteId) {
            setSuite(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubscribe = onSnapshot(
            doc(db, COLLECTIONS.TEST_SUITES, suiteId),
            (docSnap) => {
                if (docSnap.exists()) {
                    setSuite({ id: docSnap.id, ...docSnap.data() } as TestSuite);
                } else {
                    setSuite(null);
                }
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching test suite:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [suiteId]);

    return { suite, loading, error };
}

/**
 * Hook for test suite mutations
 */
export function useTestSuiteMutations() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createTestSuite = useCallback(
        async (input: CreateTestSuiteInput): Promise<string> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, input.projectId));
                const organizationId = projectSnap.data()?.organizationId;
                if (!organizationId) {
                    throw new Error('Project organization could not be resolved');
                }

                const docRef = await addDoc(collection(db, COLLECTIONS.TEST_SUITES), {
                    organizationId,
                    projectId: input.projectId,
                    name: input.name,
                    description: input.description || '',
                    tags: input.tags || [],
                    parentSuiteId: input.parentSuiteId || null,
                    order: Date.now(), // Use timestamp for initial ordering
                    createdBy: user.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                setLoading(false);
                return docRef.id;
            } catch (err) {
                const error = err as Error;
                setError(error);
                setLoading(false);
                throw error;
            }
        },
        [user]
    );

    const updateTestSuite = useCallback(
        async (suiteId: string, input: UpdateTestSuiteInput): Promise<void> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                const updateData: Record<string, unknown> = {
                    updatedAt: serverTimestamp(),
                };

                if (input.name !== undefined) updateData.name = input.name;
                if (input.description !== undefined) updateData.description = input.description;
                if (input.tags !== undefined) updateData.tags = input.tags;
                if (input.parentSuiteId !== undefined) updateData.parentSuiteId = input.parentSuiteId;
                if (input.order !== undefined) updateData.order = input.order;

                await updateDoc(doc(db, COLLECTIONS.TEST_SUITES, suiteId), updateData);
                setLoading(false);
            } catch (err) {
                const error = err as Error;
                setError(error);
                setLoading(false);
                throw error;
            }
        },
        [user]
    );

    const deleteTestSuite = useCallback(
        async (suiteId: string): Promise<void> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                await deleteDoc(doc(db, COLLECTIONS.TEST_SUITES, suiteId));
                setLoading(false);
            } catch (err) {
                const error = err as Error;
                setError(error);
                setLoading(false);
                throw error;
            }
        },
        [user]
    );

    const reorderSuites = useCallback(
        async (suiteOrders: { id: string; order: number }[]): Promise<void> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                const batch = writeBatch(db);

                suiteOrders.forEach(({ id, order }) => {
                    const suiteRef = doc(db, COLLECTIONS.TEST_SUITES, id);
                    batch.update(suiteRef, { order, updatedAt: serverTimestamp() });
                });

                await batch.commit();
                setLoading(false);
            } catch (err) {
                const error = err as Error;
                setError(error);
                setLoading(false);
                throw error;
            }
        },
        [user]
    );

    return {
        createTestSuite,
        updateTestSuite,
        deleteTestSuite,
        reorderSuites,
        loading,
        error,
    };
}
