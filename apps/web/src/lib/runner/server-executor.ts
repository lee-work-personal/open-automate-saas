import { adminDb, adminStorage } from '../firebase/admin';
import { chromium, Page } from 'playwright';
import { executeStep } from './step-executor';
import { assertLeaseOwnership, isRunStale, RunLease } from './run-lease';

// Reusing timestamp generator for admin DB
const nowTimestamp = () => adminDb.collection('dummy').doc().firestore.collection('dummy').doc().id ? new Date() : new Date(); // Or just use new Date() since admin SDK accepts JS Dates. Wait, admin.firestore.Timestamp.now() is better.
import * as admin from 'firebase-admin';

const RUN_STALE_TIMEOUT_MS = 15 * 60 * 1000;

interface StoredRunData extends Record<string, any> {
    organizationId?: string;
    type?: 'suite' | 'test-case';
    testCaseId?: string;
    testCaseIds?: string[];
    projectId?: string;
    results?: any[];
    recordVideo?: boolean;
    startedAt?: admin.firestore.Timestamp;
    cancelRequestedAt?: admin.firestore.Timestamp | Date | null;
}

class RunCancelledError extends Error {
    constructor(message = 'Run cancelled by user') {
        super(message);
        this.name = 'RunCancelledError';
    }
}

function shouldIgnoreConsoleMessage(text: string, locationUrl?: string | null) {
    if (
        text.includes('Input elements should have autocomplete attributes') ||
        text.includes('Content is cached for offline use')
    ) {
        return true;
    }

    const isArtifactAuthNoise =
        text.includes('Failed to load resource') &&
        (text.includes('401') || text.includes('403')) &&
        !!locationUrl &&
        (
            locationUrl.includes('firebasestorage.googleapis.com') ||
            locationUrl.includes('storage.googleapis.com')
        );

    return isArtifactAuthNoise;
}

async function assertRunLease(runRef: admin.firestore.DocumentReference, lease: RunLease, allowedStatuses?: string[]) {
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
        throw new Error('Run not found');
    }

    const runData = runSnap.data() as Record<string, any> & { workerId?: string | null; leaseId?: string | null; status?: string };
    return assertLeaseOwnership(runData, lease, allowedStatuses);
}

async function updateRunWithLease(runRef: admin.firestore.DocumentReference, lease: RunLease, updates: Record<string, unknown>, allowedStatuses?: string[]) {
    await assertRunLease(runRef, lease, allowedStatuses);
    await runRef.update(updates);
}

async function throwIfRunCancelled(runRef: admin.firestore.DocumentReference, lease: RunLease, allowedStatuses: string[] = ['starting', 'running']) {
    const runData = await assertRunLease(runRef, lease, allowedStatuses) as StoredRunData;

    if (runData.cancelRequestedAt || runData.status === 'cancelled') {
        throw new RunCancelledError();
    }

    return runData;
}

async function markRunCancelled(runRef: admin.firestore.DocumentReference, lease: RunLease, updates?: Record<string, unknown>) {
    await updateRunWithLease(runRef, lease, {
        status: 'cancelled',
        completedAt: admin.firestore.Timestamp.now(),
        heartbeatAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        error: null,
        ...updates,
    }, ['starting', 'running']);
}

export async function executeTestRun(runId: string, lease: RunLease) {
    if (!runId) return;

    const runRef = adminDb.collection('testRuns').doc(runId);

    try {
        const runData = await assertRunLease(runRef, lease, ['starting']) as StoredRunData;
        if (!runData) return;

        if (runData.cancelRequestedAt) {
            await markRunCancelled(runRef, lease);
            return;
        }

        console.log(`[Server Executor] Starting run ${runId} of type ${runData.type || 'test-case'}`);

        await updateRunWithLease(runRef, lease, {
            status: 'running',
            startedAt: runData.startedAt || admin.firestore.Timestamp.now(),
            heartbeatAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            executor: 'web-server',
            attemptCount: admin.firestore.FieldValue.increment(1)
        });

        if (runData.type === 'suite') {
            await processSuite(runId, runData, lease);
        } else {
            if (!runData.testCaseId) {
                throw new Error('Run is missing testCaseId');
            }
            const result = await executeSingleTestCase(runId, runData.testCaseId, runRef, lease, false, 0, runData.projectId, runData.organizationId, runData);
            if (result.cancelled) {
                return;
            }
        }

    } catch (error: any) {
        console.error(`[Server Executor] Fatal error for run ${runId}:`, error);
        try {
            if (error instanceof RunCancelledError) {
                await markRunCancelled(runRef, lease);
                return;
            }

            await updateRunWithLease(runRef, lease, {
                status: 'failed',
                completedAt: admin.firestore.Timestamp.now(),
                heartbeatAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
                error: error.message || 'Unknown error occurred'
            }, ['starting', 'running']);
        } catch (leaseError) {
            console.error(`[Server Executor] Failed to write fatal error for ${runId}:`, leaseError);
        }
    }
}

export async function markStaleRunsFailed(projectId?: string) {
    const cutoff = Date.now() - RUN_STALE_TIMEOUT_MS;
    let queryRef: FirebaseFirestore.Query = adminDb.collection('testRuns').where('status', 'in', ['starting', 'running']);

    if (projectId) {
        queryRef = queryRef.where('projectId', '==', projectId);
    }

    const snapshot = await queryRef.get();
    const staleRuns = snapshot.docs.filter((doc) => isRunStale(doc.data() as any, cutoff));

    await Promise.all(
        staleRuns.map((doc) =>
            doc.ref.update({
                status: 'failed',
                error: 'Run marked failed after executor heartbeat expired',
                completedAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now(),
                workerId: null,
                leaseId: null,
            })
        )
    );
}

async function processSuite(runId: string, runData: any, lease: RunLease) {
    const runRef = adminDb.collection('testRuns').doc(runId);
    const testCaseIds = runData.testCaseIds || [];
    const results = Array.isArray(runData.results) ? [...runData.results] : [];

    let suiteFailed = false;

    for (let i = 0; i < testCaseIds.length; i++) {
        const tcId = testCaseIds[i];
        if (!tcId) continue;

        await throwIfRunCancelled(runRef, lease, ['running']);

        if (!results[i]) {
            results[i] = { testCaseId: tcId, status: 'queued', name: 'Unknown' };
        }
        results[i] = { ...results[i], status: 'running', startedAt: admin.firestore.Timestamp.now() };
        await updateRunWithLease(runRef, lease, { results }, ['running']);

        try {
            const result = await executeSingleTestCase(runId, tcId, runRef, lease, true, i, runData.projectId, runData.organizationId, runData);
            if (result.cancelled) {
                results[i] = {
                    ...results[i],
                    status: 'cancelled',
                    completedAt: admin.firestore.Timestamp.now(),
                    logs: result.logs,
                    error: null,
                    tracePath: result.tracePath || null,
                    videoPath: result.videoPath || null,
                };

                for (let pendingIndex = i + 1; pendingIndex < results.length; pendingIndex++) {
                    if (['completed', 'failed', 'cancelled'].includes(results[pendingIndex]?.status)) continue;
                    results[pendingIndex] = {
                        ...results[pendingIndex],
                        status: 'cancelled',
                        completedAt: admin.firestore.Timestamp.now(),
                    };
                }

                await updateRunWithLease(runRef, lease, { results }, ['running']);
                await markRunCancelled(runRef, lease, { results });
                return;
            }

            results[i] = {
                ...results[i],
                status: result.failed ? 'failed' : 'completed',
                completedAt: admin.firestore.Timestamp.now(),
                logs: result.logs,
                error: result.error,
                tracePath: result.tracePath || null,
                videoPath: result.videoPath || null
            };
            if (result.failed) suiteFailed = true;
        } catch (e: any) {
            if (e instanceof RunCancelledError) {
                results[i] = {
                    ...results[i],
                    status: 'cancelled',
                    completedAt: admin.firestore.Timestamp.now(),
                };
                await updateRunWithLease(runRef, lease, { results }, ['running']);
                await markRunCancelled(runRef, lease, { results });
                return;
            }

            results[i] = {
                ...results[i],
                status: 'failed',
                completedAt: admin.firestore.Timestamp.now(),
                error: e.message
            };
            suiteFailed = true;
        }

        await updateRunWithLease(runRef, lease, { results }, ['running']);
    }

    await updateRunWithLease(runRef, lease, {
        status: suiteFailed ? 'failed' : 'completed',
        completedAt: admin.firestore.Timestamp.now(),
        heartbeatAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
    }, ['running']);
}

async function executeSingleTestCase(
    runId: string,
    testCaseId: string,
    runRef: admin.firestore.DocumentReference,
    lease: RunLease,
    isSuite: boolean = false,
    suiteIndex: number = 0,
    projectId?: string,
    organizationId?: string,
    runData?: any
) {
    if (!testCaseId) {
        return { failed: true, cancelled: false, error: "Test Case ID is missing", logs: [] };
    }

    const tcRef = adminDb.collection('testCases').doc(testCaseId);
    const tcSnap = await tcRef.get();

    if (!tcSnap.exists) {
        return { failed: true, cancelled: false, error: "Test Case not found in database", logs: [] };
    }

    const tcData = tcSnap.data();
    if (!tcData) {
        return { failed: true, cancelled: false, error: "Test case document is empty", logs: [] };
    }

    const steps = tcData.steps || [];
    const variables = await fetchProjectVariables(tcData.projectId);

    const substituteVariables = (text?: any) => {
        if (typeof text !== 'string') return text;
        return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
            const val = variables[key];
            return val !== undefined ? val : `{{${key}}}`;
        });
    };

    const contextOptions: any = {};
    if (runData?.recordVideo) {
        contextOptions.recordVideo = { dir: `/tmp/videos/${runId}_${testCaseId}` };
    }

    // Need headless: true for server environment!
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(contextOptions);
    
    // Always start tracing for test cases
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    
    const page = await context.newPage();

    let failed = false;
    let cancelled = false;
    let errorMsg = '';
    const logs: any[] = [];
    const consoleLogs: any[] = [];

    page.on('console', msg => {
        const text = msg.text();
        const type = msg.type();
        const loc = msg.location();
        if (shouldIgnoreConsoleMessage(text, loc.url || null)) return;

        consoleLogs.push({
            type: type,
            text: text,
            location: {
                url: loc.url || null,
                lineNumber: loc.lineNumber || null,
                columnNumber: loc.columnNumber || null
            },
            timestamp: Date.now()
        });
    });

    let storedTracePath: string | null = null;
    let videoPath: string | null = null;

    try {
        for (const step of steps) {
            await throwIfRunCancelled(runRef, lease, ['running']);

            const stepValue = substituteVariables(step.value);
            const stepSelector = substituteVariables(step.selector);

            const startTime = Date.now();
            const logEntry: any = {
                stepId: step.id || null,
                action: step.action || 'unknown',
                selector: stepSelector || null,
                value: stepValue || null,
                status: 'running',
                timestamp: Date.now()
            };

            logs.push(logEntry);
            await updateRunLogs(runRef, lease, logs, isSuite, suiteIndex, consoleLogs);

            try {
                await executeStep(page, step, stepValue || '', stepSelector || '', substituteVariables);
                logEntry.status = 'passed';
                logEntry.duration = Date.now() - startTime;
                await throwIfRunCancelled(runRef, lease, ['running']);
                await updateRunLogs(runRef, lease, logs, isSuite, suiteIndex, consoleLogs);
            } catch (e: any) {
                failed = true;
                errorMsg = e.message;
                logEntry.status = 'failed';
                logEntry.error = e.message;

                // Capture Screenshot on Failure via Admin Storage
                try {
                    const screenshotBuffer = await page.screenshot({ type: 'png' });
                    if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
                        const screenshotPath = `screenshots/${organizationId || 'unknown-org'}/${projectId || 'unknown'}/${runId}/${testCaseId}_${step.id}.png`;
                        const file = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
                           .file(screenshotPath);
                        
                        await file.save(screenshotBuffer, {
                            contentType: 'image/png',
                        });
                        logEntry.screenshotPath = screenshotPath;
                    }
                } catch (screenshotError: any) {
                    console.error(`Screenshot Failed:`, screenshotError);
                }

                logEntry.duration = Date.now() - startTime;
                await updateRunLogs(runRef, lease, logs, isSuite, suiteIndex, consoleLogs);
                break;
            }
        }
    } catch (e: any) {
        if (e instanceof RunCancelledError) {
            cancelled = true;
            errorMsg = e.message;
        } else {
            throw e;
        }
    } finally {
        const localTracePath = `/tmp/trace_${runId}_${testCaseId}.zip`;
        await context.tracing.stop({ path: localTracePath });
        
        await page.close();
        await context.close();

        try {
            const fs = require('fs');
            // Upload Trace
            if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET && fs.existsSync(localTracePath)) {
                const traceBuffer = fs.readFileSync(localTracePath);
                const storageTracePath = `traces/${organizationId || 'unknown-org'}/${projectId || 'unknown'}/${runId}/${testCaseId}.zip`;
                const traceFile = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
                    .file(storageTracePath);
                
                await traceFile.save(traceBuffer, {
                    contentType: 'application/zip',
                });
                storedTracePath = storageTracePath;
                fs.unlinkSync(localTracePath);
            }

            // Upload Video
            if (runData?.recordVideo && process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
                const videoDir = `/tmp/videos/${runId}_${testCaseId}`;
                if (fs.existsSync(videoDir)) {
                    const files = fs.readdirSync(videoDir);
                    const webmFile = files.find((f: string) => f.endsWith('.webm'));
                    if (webmFile) {
                        const videoBuffer = fs.readFileSync(`${videoDir}/${webmFile}`);
                        const videoFile = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)
                            .file(`videos/${organizationId || 'unknown-org'}/${projectId || 'unknown'}/${runId}/${testCaseId}.webm`);
                        
                        await videoFile.save(videoBuffer, {
                            contentType: 'video/webm',
                        });
                        videoPath = `videos/${organizationId || 'unknown-org'}/${projectId || 'unknown'}/${runId}/${testCaseId}.webm`;
                    }
                }
            }
        } catch (uploadError) {
            console.error("Artifact upload failed", uploadError);
        }

        await browser.close();
    }

    if (!isSuite) {
        await updateRunWithLease(runRef, lease, {
            status: cancelled ? 'cancelled' : failed ? 'failed' : 'completed',
            completedAt: admin.firestore.Timestamp.now(),
            heartbeatAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
            error: failed ? errorMsg : null,
            logs: sanitizeForFirestore(logs),
            consoleLogs: sanitizeForFirestore(consoleLogs),
            tracePath: storedTracePath || null,
            videoPath: videoPath || null
        }, ['running']);
    }

    return { failed, cancelled, error: failed ? errorMsg : null, logs, tracePath: storedTracePath, videoPath };
}

async function fetchProjectVariables(projectId: string) {
    const variables: Record<string, string> = {};
    if (!projectId) return variables;
    try {
        const varsSnap = await adminDb.collection('variables').where('projectId', '==', projectId).get();
        varsSnap.forEach(doc => {
            const data = doc.data();
            variables[data.key] = data.value;
        });
    } catch (e) {
        console.error("Failed to load variables", e);
    }
    return variables;
}

function sanitizeForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);

    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            newObj[key] = val === undefined ? null : sanitizeForFirestore(val);
        }
    }
    return newObj;
}

async function updateRunLogs(runRef: admin.firestore.DocumentReference, lease: RunLease, logs: any[], isSuite: boolean, suiteIndex: number, consoleLogs: any[] = []) {
    const sanitizedLogs = sanitizeForFirestore(logs);
    const sanitizedConsoleLogs = sanitizeForFirestore(consoleLogs);
    const heartbeat = admin.firestore.Timestamp.now();

    if (isSuite) {
        await assertRunLease(runRef, lease, ['running']);
        const runSnap = await runRef.get();
        const data = runSnap.data() as any;
        const results = data?.results || [];
        if (results[suiteIndex]) {
            results[suiteIndex] = { ...results[suiteIndex], logs: sanitizedLogs, consoleLogs: sanitizedConsoleLogs };
            await updateRunWithLease(runRef, lease, { results, heartbeatAt: heartbeat, updatedAt: heartbeat }, ['running']);
        }
    } else {
        await updateRunWithLease(runRef, lease, { logs: sanitizedLogs, consoleLogs: sanitizedConsoleLogs, heartbeatAt: heartbeat, updatedAt: heartbeat }, ['running']);
    }
}
