import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireProjectAccess } from '@/lib/server/auth';

async function listMembers(projectId: string) {
    const projectSnap = await adminDb.collection('projects').doc(projectId).get();
    if (!projectSnap.exists) {
        throw new Error('Project not found');
    }

    const project = projectSnap.data() as { ownerId: string; members?: string[] };
    const memberIds = Array.from(new Set([project.ownerId, ...(project.members || [])]));
    const userSnaps = await Promise.all(memberIds.map((id) => adminDb.collection('users').doc(id).get()));

    return userSnaps
        .filter((snap) => snap.exists)
        .map((snap) => {
            const data = snap.data() as { email?: string; displayName?: string };
            return {
                id: snap.id,
                email: data.email || '',
                displayName: data.displayName || '',
                role: snap.id === project.ownerId ? 'owner' : 'viewer',
            };
        });
}

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
        return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    try {
        await requireProjectAccess(req, projectId);
        const members = await listMembers(projectId);
        return NextResponse.json({ success: true, members });
    } catch (error: any) {
        const status = error.message === 'Project access denied' ? 403 : 400;
        return NextResponse.json({ error: error.message || 'Failed to load members' }, { status });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const projectId = body.projectId as string | undefined;
        const email = body.email?.trim().toLowerCase();

        if (!projectId || !email) {
            return NextResponse.json({ error: 'projectId and email are required' }, { status: 400 });
        }

        await requireProjectAccess(req, projectId, { ownerOnly: true });

        const userQuery = await adminDb
            .collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (userQuery.empty) {
            return NextResponse.json({ error: 'User not found. They need to sign in once before being added.' }, { status: 404 });
        }

        const memberUser = userQuery.docs[0];
        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectSnap = await projectRef.get();
        const project = projectSnap.data() as { ownerId: string; members?: string[]; organizationId?: string };

        if (memberUser.id === project.ownerId) {
            return NextResponse.json({ error: 'Owner is already part of the project' }, { status: 400 });
        }

        if ((project.members || []).includes(memberUser.id)) {
            return NextResponse.json({ error: 'User is already a member of this project' }, { status: 409 });
        }

        if (project.organizationId) {
            const organizationSnap = await adminDb.collection('organizations').doc(project.organizationId).get();
            const organization = organizationSnap.data() as { ownerId: string; members?: string[] } | undefined;
            const isOrganizationMember =
                !!organization &&
                (organization.ownerId === memberUser.id || (organization.members || []).includes(memberUser.id));

            if (!isOrganizationMember) {
                return NextResponse.json(
                    { error: 'User must be added to the workspace before they can access this project' },
                    { status: 400 }
                );
            }
        }

        await projectRef.update({
            members: FieldValue.arrayUnion(memberUser.id),
            updatedAt: new Date(),
        });

        return NextResponse.json({ success: true, members: await listMembers(projectId) });
    } catch (error: any) {
        const status = error.message === 'Owner access required' ? 403 : 400;
        return NextResponse.json({ error: error.message || 'Failed to add member' }, { status });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const projectId = body.projectId as string | undefined;
        const memberId = body.memberId as string | undefined;

        if (!projectId || !memberId) {
            return NextResponse.json({ error: 'projectId and memberId are required' }, { status: 400 });
        }

        await requireProjectAccess(req, projectId, { ownerOnly: true });

        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectSnap = await projectRef.get();
        const project = projectSnap.data() as { ownerId: string };

        if (memberId === project.ownerId) {
            return NextResponse.json({ error: 'Owner cannot be removed from the project' }, { status: 400 });
        }

        await projectRef.update({
            members: FieldValue.arrayRemove(memberId),
            updatedAt: new Date(),
        });

        return NextResponse.json({ success: true, members: await listMembers(projectId) });
    } catch (error: any) {
        const status = error.message === 'Owner access required' ? 403 : 400;
        return NextResponse.json({ error: error.message || 'Failed to remove member' }, { status });
    }
}
