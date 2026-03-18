import { readFileSync } from 'fs';
import path from 'path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment,
    RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

function resolveProjectId() {
    if (process.env.GCLOUD_PROJECT) {
        return process.env.GCLOUD_PROJECT;
    }

    if (process.env.FIREBASE_CONFIG) {
        try {
            const config = JSON.parse(process.env.FIREBASE_CONFIG);
            if (config.projectId) {
                return config.projectId;
            }
        } catch {
            // Ignore malformed Firebase config in tests and fall back.
        }
    }

    return 'openautomate-integration';
}

const projectId = resolveProjectId();
const firestoreRules = readFileSync(
    path.resolve(__dirname, '../../../../firebase/firestore.rules'),
    'utf8'
);

let testEnv: RulesTestEnvironment;

function nowFixture() {
    return new Date('2026-03-20T10:00:00.000Z');
}

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId,
        firestore: {
            host: '127.0.0.1',
            port: 8080,
            rules: firestoreRules,
        },
    });
});

afterEach(async () => {
    await testEnv.clearFirestore();
});

afterAll(async () => {
    await testEnv.cleanup();
});

async function seedProject() {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, 'organizations', 'org-1'), {
            name: 'Owner Workspace',
            slug: 'owner-workspace',
            ownerId: 'owner-1',
            members: ['owner-1', 'viewer-1'],
            createdAt: nowFixture(),
            updatedAt: nowFixture(),
        });

        await setDoc(doc(db, 'projects', 'project-1'), {
            organizationId: 'org-1',
            name: 'Portal',
            description: 'Main project',
            baseUrl: 'https://portal.example.com',
            ownerId: 'owner-1',
            members: ['viewer-1'],
            idPrefix: 'PTL',
            lastTestNumber: 0,
            settings: {
                defaultBrowser: 'chromium',
                defaultViewport: { width: 1280, height: 720 },
                screenshotOnFailure: true,
                videoRecording: false,
            },
            createdAt: nowFixture(),
            updatedAt: nowFixture(),
        });

        await setDoc(doc(db, 'testSuites', 'suite-1'), {
            organizationId: 'org-1',
            projectId: 'project-1',
            name: 'Authentication',
            description: '',
            tags: [],
            order: 0,
            createdBy: 'owner-1',
            createdAt: nowFixture(),
            updatedAt: nowFixture(),
        });

        await setDoc(doc(db, 'testCases', 'case-1'), {
            organizationId: 'org-1',
            projectId: 'project-1',
            suiteIds: ['suite-1'],
            testId: 'PTL-1',
            name: 'Login',
            description: '',
            priority: 'medium',
            status: 'active',
            tags: [],
            steps: [],
            createdBy: 'owner-1',
            lastEditedBy: 'owner-1',
            createdAt: nowFixture(),
            updatedAt: nowFixture(),
        });
    });
}

describe('Firestore rules integration', () => {
    it('allows an owner to create a project', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'organizations', 'org-owner'), {
                name: 'Owner Workspace',
                slug: 'owner-workspace',
                ownerId: 'owner-1',
                members: ['owner-1'],
                createdAt: nowFixture(),
                updatedAt: nowFixture(),
            });
        });

        const db = testEnv.authenticatedContext('owner-1').firestore();

        await assertSucceeds(
            setDoc(doc(db, 'projects', 'project-owner'), {
                organizationId: 'org-owner',
                name: 'Owner Project',
                description: '',
                baseUrl: 'https://owner.example.com',
                ownerId: 'owner-1',
                members: [],
                idPrefix: 'OWN',
                lastTestNumber: 0,
                settings: {
                    defaultBrowser: 'chromium',
                    defaultViewport: { width: 1280, height: 720 },
                    screenshotOnFailure: true,
                    videoRecording: false,
                },
                createdAt: nowFixture(),
                updatedAt: nowFixture(),
            })
        );
    });

    it('allows a viewer to read a shared project but not update it', async () => {
        await seedProject();
        const db = testEnv.authenticatedContext('viewer-1').firestore();

        await assertSucceeds(getDoc(doc(db, 'projects', 'project-1')));
        await assertFails(
            updateDoc(doc(db, 'projects', 'project-1'), {
                description: 'viewer should not edit',
            })
        );
    });

    it('allows a viewer to read suites and test cases for a shared project', async () => {
        await seedProject();
        const db = testEnv.authenticatedContext('viewer-1').firestore();

        await assertSucceeds(getDoc(doc(db, 'testSuites', 'suite-1')));
        await assertSucceeds(getDoc(doc(db, 'testCases', 'case-1')));
    });

    it('prevents a viewer from creating a test run', async () => {
        await seedProject();
        const db = testEnv.authenticatedContext('viewer-1').firestore();

        await assertFails(
            setDoc(doc(db, 'testRuns', 'run-viewer'), {
                organizationId: 'org-1',
                projectId: 'project-1',
                testCaseId: 'case-1',
                name: 'Viewer Run',
                type: 'test-case',
                status: 'queued',
                triggeredBy: 'viewer-1',
                createdAt: nowFixture(),
                updatedAt: nowFixture(),
            })
        );
    });

    it('allows an owner to queue a test run', async () => {
        await seedProject();
        const db = testEnv.authenticatedContext('owner-1').firestore();

        await assertSucceeds(
            setDoc(doc(db, 'testRuns', 'run-owner'), {
                organizationId: 'org-1',
                projectId: 'project-1',
                testCaseId: 'case-1',
                name: 'Owner Run',
                type: 'test-case',
                status: 'queued',
                triggeredBy: 'owner-1',
                createdAt: nowFixture(),
                updatedAt: nowFixture(),
            })
        );
    });
});
