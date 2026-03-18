import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireAuthenticatedUser } from '@/lib/server/auth';
import { isSaaSAdminEmail } from '@/lib/server/saas-admin';

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await requireAuthenticatedUser(req);
        if (!isSaaSAdminEmail(decodedToken.email)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const [organizationsSnap, projectsSnap, runsSnap, usersSnap] = await Promise.all([
            adminDb.collection('organizations').get(),
            adminDb.collection('projects').get(),
            adminDb.collection('testRuns').get(),
            adminDb.collection('users').get(),
        ]);

        const usersById = new Map<string, { email?: string; displayName?: string }>();
        usersSnap.forEach((doc) => usersById.set(doc.id, doc.data() as any));

        const projectsByOrganization = new Map<string, number>();
        const runsByOrganization = new Map<string, number>();
        const latestActivityByOrganization = new Map<string, number>();

        projectsSnap.forEach((doc) => {
            const data = doc.data() as { organizationId?: string; updatedAt?: { toMillis?: () => number } };
            if (!data.organizationId) return;
            projectsByOrganization.set(data.organizationId, (projectsByOrganization.get(data.organizationId) || 0) + 1);
            latestActivityByOrganization.set(
                data.organizationId,
                Math.max(latestActivityByOrganization.get(data.organizationId) || 0, data.updatedAt?.toMillis?.() || 0)
            );
        });

        runsSnap.forEach((doc) => {
            const data = doc.data() as { organizationId?: string; updatedAt?: { toMillis?: () => number } };
            if (!data.organizationId) return;
            runsByOrganization.set(data.organizationId, (runsByOrganization.get(data.organizationId) || 0) + 1);
            latestActivityByOrganization.set(
                data.organizationId,
                Math.max(latestActivityByOrganization.get(data.organizationId) || 0, data.updatedAt?.toMillis?.() || 0)
            );
        });

        const organizations = organizationsSnap.docs.map((doc) => {
            const data = doc.data() as {
                name: string;
                ownerId: string;
                members?: string[];
                plan?: string;
                billingStatus?: string;
                createdAt?: { toMillis?: () => number };
            };
            const ownerProfile = usersById.get(data.ownerId);
            return {
                id: doc.id,
                name: data.name,
                ownerId: data.ownerId,
                ownerEmail: ownerProfile?.email || null,
                ownerName: ownerProfile?.displayName || null,
                memberCount: new Set(data.members || []).size,
                projectCount: projectsByOrganization.get(doc.id) || 0,
                runCount: runsByOrganization.get(doc.id) || 0,
                plan: data.plan || 'free',
                billingStatus: data.billingStatus || 'trial',
                createdAt: data.createdAt?.toMillis?.() || null,
                lastActivityAt: latestActivityByOrganization.get(doc.id) || null,
            };
        }).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));

        return NextResponse.json({
            success: true,
            summary: {
                organizationCount: organizations.length,
                projectCount: projectsSnap.size,
                runCount: runsSnap.size,
                activeOrganizations: organizations.filter((organization) => organization.runCount > 0).length,
            },
            organizations,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to load admin overview' }, { status: 500 });
    }
}
