
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';

export interface LogEntry {
    stepId: string;
    action: string;
    selector: string;
    status: 'running' | 'passed' | 'failed';
    timestamp: number;
    duration?: number;
    error?: string;
    screenshotUrl?: string; // URL to screenshot on failure
    screenshotPath?: string;
}

export interface ConsoleLogEntry {
    type: string;
    text: string;
    timestamp: number;
    location?: any;
}

export interface TestRun {
    id: string;
    organizationId?: string;
    projectId: string;
    testCaseId?: string;
    name?: string;
    status: 'queued' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
    triggeredBy: string;
    createdAt: any;
    updatedAt: any;
    heartbeatAt?: any;
    cancelRequestedAt?: any;
    cancelRequestedBy?: string | null;
    lastAttemptAt?: any;
    attemptCount?: number;
    workerId?: string | null;
    leaseId?: string | null;
    startedAt?: any;
    completedAt?: any;
    logs?: LogEntry[];
    error?: string;
    videoUrl?: string;
    traceUrl?: string;
    videoPath?: string;
    tracePath?: string;
    type: 'test-case' | 'suite';
    suiteId?: string;
    testCaseIds?: string[];
    consoleLogs?: ConsoleLogEntry[];
    results?: {
        testCaseId: string;
        name: string;
        status: 'queued' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
        logs?: LogEntry[];
        consoleLogs?: ConsoleLogEntry[];
        error?: string;
        videoUrl?: string;
        videoPath?: string;
        startedAt?: any;
        completedAt?: any;
        traceUrl?: string;
        tracePath?: string;
    }[];
}

export function useTestRuns(projectId: string) {
    const [testRuns, setTestRuns] = useState<TestRun[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!projectId) return;

        // Query test runs for this project
        // Note: Sort by createdAt desc requires an index. 
        // If it fails, I'll remove orderBy for now or we need to create index.
        const q = query(
            collection(db, 'testRuns'),
            where('projectId', '==', projectId),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const runs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TestRun));
            setTestRuns(runs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching test runs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [projectId]);

    return { testRuns, loading };
}
