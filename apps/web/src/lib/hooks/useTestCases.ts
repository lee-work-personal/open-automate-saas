'use client';

/**
 * Firestore Hooks for Test Cases
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
    getDocs,
    runTransaction,
    increment,
    setDoc,
    arrayUnion,
    arrayRemove,
} from 'firebase/firestore';
import { db, useAuth } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/constants';

// Types
export type TestAction =
    | 'navigate'
    | 'click'
    | 'dblclick'
    | 'rightclick'
    | 'type'
    | 'clear'
    | 'select'
    | 'check'
    | 'uncheck'
    | 'hover'
    | 'scroll'
    | 'wait'
    | 'press'
    | 'upload'
    | 'assert'
    | 'screenshot';

export type SelectorType = 'css' | 'xpath' | 'text' | 'testId';
export type AssertionType = 'visible' | 'hidden' | 'exists' | 'notExists' | 'text' | 'value' | 'url' | 'title' | 'attribute';
export type AssertionOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'matches';

export interface TestStep {
    id: string;
    order: number;
    action: TestAction;
    // Automation fields
    selector?: string;
    selectorType?: SelectorType;
    value?: string;
    // Manual testing fields
    description?: string;
    manualAction?: string;
    expectedResult?: string;
    // Meta fields
    screenshot?: boolean;
    timeout?: number;
    optional?: boolean;
    // For assertions
    assertionType?: AssertionType;
    expectedValue?: string;
    operator?: AssertionOperator;
}

export interface TestCase {
    id: string;
    organizationId: string;
    projectId: string;
    suiteIds: string[];
    testId: string;
    name: string;
    description?: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    status: 'draft' | 'active' | 'deprecated';
    tags: string[];
    preconditions?: string;
    expectedResult?: string;
    steps: TestStep[];
    estimatedDuration?: number;
    createdBy: string;
    lastEditedBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface CreateTestCaseInput {
    projectId: string;
    suiteIds?: string[]; // Arrays
    testId?: string;
    name: string;
    description?: string;
    priority?: TestCase['priority'];
    tags?: string[];
    preconditions?: string;
    expectedResult?: string;
    steps?: TestStep[];
}

export interface UpdateTestCaseInput {
    testId?: string;
    name?: string;
    description?: string;
    priority?: TestCase['priority'];
    status?: TestCase['status'];
    tags?: string[];
    preconditions?: string;
    expectedResult?: string;
    steps?: TestStep[];
    suiteIds?: string[];
}

/**
 * Hook to fetch test cases for a project or suite
 */
export function useTestCases(projectId: string | null, suiteId?: string | null) {
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!projectId) {
            setTestCases([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        let q;
        if (suiteId) {
            q = query(
                collection(db, COLLECTIONS.TEST_CASES),
                where('projectId', '==', projectId),
                where('suiteIds', 'array-contains', suiteId)
            );
        } else {
            q = query(
                collection(db, COLLECTIONS.TEST_CASES),
                where('projectId', '==', projectId)
            );
        }

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const caseList: TestCase[] = [];
                snapshot.forEach((doc) => {
                    caseList.push({ id: doc.id, ...doc.data() } as TestCase);
                });
                // Sort client-side to avoid composite index requirement
                caseList.sort((a, b) => {
                    const aTime = a.createdAt?.toMillis() || 0;
                    const bTime = b.createdAt?.toMillis() || 0;
                    return bTime - aTime; // desc
                });
                setTestCases(caseList);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching test cases:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [projectId, suiteId]);

    return { testCases, loading, error };
}

/**
 * Hook to fetch a single test case
 */
export function useTestCase(testCaseId: string | null) {
    const [testCase, setTestCase] = useState<TestCase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!testCaseId) {
            setTestCase(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubscribe = onSnapshot(
            doc(db, COLLECTIONS.TEST_CASES, testCaseId),
            (docSnap) => {
                if (docSnap.exists()) {
                    setTestCase({ id: docSnap.id, ...docSnap.data() } as TestCase);
                } else {
                    setTestCase(null);
                }
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching test case:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [testCaseId]);

    return { testCase, loading, error };
}

/**
 * Hook for test case mutations
 */
export function useTestCaseMutations() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createTestCase = useCallback(
        async (input: CreateTestCaseInput): Promise<string> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                const projectRef = doc(db, COLLECTIONS.PROJECTS, input.projectId);
                const testCaseRef = doc(collection(db, COLLECTIONS.TEST_CASES));

                let testId = '';

                await runTransaction(db, async (transaction) => {
                    const projectSnap = await transaction.get(projectRef);
                    if (!projectSnap.exists()) {
                        throw new Error("Project does not exist!");
                    }

                    const projectData = projectSnap.data();
                    const organizationId = projectData.organizationId;
                    if (!organizationId) {
                        throw new Error('Project organization could not be resolved');
                    }
                    const nextNumber = (projectData.lastTestNumber || 0) + 1;
                    const prefix = projectData.idPrefix || 'TC';
                    testId = input.testId || `${prefix}-${nextNumber}`;

                    // Update project counter
                    transaction.update(projectRef, {
                        lastTestNumber: nextNumber,
                        updatedAt: serverTimestamp()
                    });

                    // Create test case
                    transaction.set(testCaseRef, {
                        organizationId,
                        projectId: input.projectId,
                        suiteIds: input.suiteIds || [],
                        testId: testId,
                        name: input.name,
                        description: input.description || '',
                        priority: input.priority || 'medium',
                        status: 'draft',
                        tags: input.tags || [],
                        preconditions: input.preconditions || '',
                        expectedResult: input.expectedResult || '',
                        steps: input.steps || [],
                        estimatedDuration: null,
                        createdBy: user.uid,
                        lastEditedBy: user.uid,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                });

                setLoading(false);
                return testCaseRef.id;
            } catch (err) {
                const error = err as Error;
                setError(error);
                setLoading(false);
                throw error;
            }
        },
        [user]
    );

    const updateTestCase = useCallback(
        async (testCaseId: string, input: UpdateTestCaseInput): Promise<void> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                const updateData: Record<string, unknown> = {
                    lastEditedBy: user.uid,
                    updatedAt: serverTimestamp(),
                };

                if (input.testId !== undefined) updateData.testId = input.testId;
                if (input.name !== undefined) updateData.name = input.name;
                if (input.description !== undefined) updateData.description = input.description;
                if (input.priority !== undefined) updateData.priority = input.priority;
                if (input.status !== undefined) updateData.status = input.status;
                if (input.tags !== undefined) updateData.tags = input.tags;
                if (input.preconditions !== undefined) updateData.preconditions = input.preconditions;
                if (input.expectedResult !== undefined) updateData.expectedResult = input.expectedResult;
                if (input.steps !== undefined) updateData.steps = input.steps;
                if (input.suiteIds !== undefined) updateData.suiteIds = input.suiteIds;

                await updateDoc(doc(db, COLLECTIONS.TEST_CASES, testCaseId), updateData);
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

    const deleteTestCase = useCallback(
        async (testCaseId: string): Promise<void> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                await deleteDoc(doc(db, COLLECTIONS.TEST_CASES, testCaseId));
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

    const duplicateTestCase = useCallback(
        async (testCaseId: string): Promise<string> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                // Fetch original test case
                const q = query(
                    collection(db, COLLECTIONS.TEST_CASES),
                    where('__name__', '==', testCaseId)
                );
                const snapshot = await getDocs(q);

                if (snapshot.empty) throw new Error('Test case not found');

                const original = snapshot.docs[0].data();

                // Create duplicate
                const docRef = await addDoc(collection(db, COLLECTIONS.TEST_CASES), {
                    ...original,
                    name: `${original.name} (Copy)`,
                    status: 'draft',
                    createdBy: user.uid,
                    lastEditedBy: user.uid,
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

    const bulkDeleteTestCases = useCallback(
        async (testCaseIds: string[]): Promise<void> => {
            if (!user) throw new Error('Not authenticated');

            setLoading(true);
            setError(null);

            try {
                const batch = writeBatch(db);

                testCaseIds.forEach((id) => {
                    batch.delete(doc(db, COLLECTIONS.TEST_CASES, id));
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

    const addToSuite = useCallback(
        async (testCaseIds: string[], suiteId: string): Promise<void> => {
            if (!user) throw new Error('Not authenticated');
            // Optimistic update logic not strictly needed for batch but nice.

            setLoading(true);
            try {
                const batch = writeBatch(db);
                testCaseIds.forEach(id => {
                    batch.update(doc(db, COLLECTIONS.TEST_CASES, id), {
                        suiteIds: arrayUnion(suiteId),
                        lastEditedBy: user.uid,
                        updatedAt: serverTimestamp()
                    });
                });
                await batch.commit();
                setLoading(false);
            } catch (err) {
                setError(err as Error);
                setLoading(false);
                throw err;
            }
        },
        [user]
    );

    const removeFromSuite = useCallback(
        async (testCaseIds: string[], suiteId: string): Promise<void> => {
            if (!user) throw new Error('Not authenticated');
            setLoading(true);
            try {
                const batch = writeBatch(db);
                testCaseIds.forEach(id => {
                    batch.update(doc(db, COLLECTIONS.TEST_CASES, id), {
                        suiteIds: arrayRemove(suiteId),
                        lastEditedBy: user.uid,
                        updatedAt: serverTimestamp()
                    });
                });
                await batch.commit();
                setLoading(false);
            } catch (err) {
                setError(err as Error);
                setLoading(false);
                throw err;
            }
        },
        [user]
    );

    /**
     * Move test cases to a specific suite (replaces all existing suiteIds)
     */
    const batchMoveToSuite = useCallback(
        async (testCaseIds: string[], targetSuiteId: string): Promise<void> => {
            if (!user) throw new Error('Not authenticated');
            setLoading(true);
            setError(null);
            try {
                const batch = writeBatch(db);
                testCaseIds.forEach(id => {
                    batch.update(doc(db, COLLECTIONS.TEST_CASES, id), {
                        suiteIds: [targetSuiteId],
                        lastEditedBy: user.uid,
                        updatedAt: serverTimestamp()
                    });
                });
                await batch.commit();
                setLoading(false);
            } catch (err) {
                setError(err as Error);
                setLoading(false);
                throw err;
            }
        },
        [user]
    );

    return {
        createTestCase,
        updateTestCase,
        deleteTestCase,
        duplicateTestCase,
        bulkDeleteTestCases,
        addToSuite,
        removeFromSuite,
        batchMoveToSuite,
        loading,
        error,
    };
}
