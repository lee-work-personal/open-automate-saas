import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, Timestamp, doc, onSnapshot, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { TestRun } from './useTestRuns';
import { COLLECTIONS } from '@/lib/constants';

export function useTestRun() {
    const [loading, setLoading] = useState(false);

    const queueTestRun = async (projectId: string, testCaseId: string, customName?: string, options?: { recordVideo?: boolean }) => {
        if (!auth.currentUser) return;

        setLoading(true);
        try {
            const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
            const organizationId = projectSnap.data()?.organizationId;
            if (!organizationId) {
                throw new Error('Project organization could not be resolved');
            }

            const defaultName = `Run - ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;

            const docRef = await addDoc(collection(db, COLLECTIONS.TEST_RUNS), {
                organizationId,
                projectId,
                testCaseId,
                name: customName || defaultName,
                type: 'test-case',
                status: 'queued',
                triggeredBy: auth.currentUser.uid,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                browser: 'chromium', // Default for now
                recordVideo: options?.recordVideo || false,
            });

            // Trigger local runner bridge (Approach B)
            // We do this as a "fire and forget" call. 
            // If it's not running locally, it will just fail silently.
            toast.success('Test run queued. The worker will pick it up shortly.');
        } catch (error: any) {
            console.error(error);
            toast.error('Failed to queue test run');
        } finally {
            setLoading(false);
        }
    };

    const queueSuiteRun = async (projectId: string, suiteId: string, suiteName: string, testCases: { id: string, name: string }[], options?: { recordVideo?: boolean }) => {
        if (!auth.currentUser) return;

        setLoading(true);
        try {
            const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
            const organizationId = projectSnap.data()?.organizationId;
            if (!organizationId) {
                throw new Error('Project organization could not be resolved');
            }

            const runName = `${suiteName} - ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;

            const docRef = await addDoc(collection(db, COLLECTIONS.TEST_RUNS), {
                organizationId,
                projectId,
                suiteId,
                name: runName,
                type: 'suite',
                status: 'queued',
                triggeredBy: auth.currentUser.uid,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
                testCaseIds: testCases.map(tc => tc.id),
                results: testCases.map(tc => ({
                    testCaseId: tc.id,
                    name: tc.name,
                    status: 'queued'
                })),
                browser: 'chromium',
                recordVideo: options?.recordVideo || false,
            });

            // Trigger local runner bridge
            toast.success('Suite run queued. The worker will pick it up shortly.');
        } catch (error: any) {
            console.error(error);
            toast.error('Failed to queue suite run');
        } finally {
            setLoading(false);
        }
    };

    return { queueTestRun, queueSuiteRun, loading };
}

export function useTestRunDetails(runId: string | null) {
    const [run, setRun] = useState<TestRun | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!runId) {
            setRun(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsubscribe = onSnapshot(
            doc(db, 'testRuns', runId),
            (docSnap) => {
                if (docSnap.exists()) {
                    setRun({ id: docSnap.id, ...docSnap.data() } as TestRun);
                } else {
                    setRun(null);
                }
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching test run details:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [runId]);

    return { run, loading, error };
}
