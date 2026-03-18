import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireOrganizationAccess } from '@/lib/server/auth';

async function listMembers(organizationId: string) {
    const organizationSnap = await adminDb.collection('organizations').doc(organizationId).get();
    if (!organizationSnap.exists) {
        throw new Error('Organization not found');
    }

    const organization = organizationSnap.data() as { ownerId: string; members?: string[] };
    const memberIds = Array.from(new Set([organization.ownerId, ...(organization.members || [])]));
    const userSnaps = await Promise.all(memberIds.map((id) => adminDb.collection('users').doc(id).get()));

    return userSnaps
        .filter((snap) => snap.exists)
        .map((snap) => {
            const data = snap.data() as { email?: string; displayName?: string };
            return {
                id: snap.id,
                email: data.email || '',
                displayName: data.displayName || '',
                role: snap.id === organization.ownerId ? 'owner' : 'member',
            };
        });
}

export async function GET(req: NextRequest) {
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    if (!organizationId) {
        return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    try {
        await requireOrganizationAccess(req, organizationId);
        const members = await listMembers(organizationId);
        return NextResponse.json({ success: true, members });
    } catch (error: any) {
        const status = error.message === 'Organization access denied' ? 403 : 400;
        return NextResponse.json({ error: error.message || 'Failed to load members' }, { status });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const organizationId = body.organizationId as string | undefined;
        const email = body.email?.trim().toLowerCase();

        if (!organizationId || !email) {
            return NextResponse.json({ error: 'organizationId and email are required' }, { status: 400 });
        }

        await requireOrganizationAccess(req, organizationId, { ownerOnly: true });

        const userQuery = await adminDb.collection('users').where('email', '==', email).limit(1).get();
        if (userQuery.empty) {
            return NextResponse.json({ error: 'User not found. They need to sign in once before being added.' }, { status: 404 });
        }

        const memberUser = userQuery.docs[0];
        const organizationRef = adminDb.collection('organizations').doc(organizationId);
        const organizationSnap = await organizationRef.get();
        const organization = organizationSnap.data() as { ownerId: string; members?: string[] };

        if (memberUser.id === organization.ownerId) {
            return NextResponse.json({ error: 'Owner is already part of this workspace' }, { status: 400 });
        }

        if ((organization.members || []).includes(memberUser.id)) {
            return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 409 });
        }

        await Promise.all([
            organizationRef.update({
                members: FieldValue.arrayUnion(memberUser.id),
                updatedAt: new Date(),
            }),
            adminDb.collection('users').doc(memberUser.id).set(
                {
                    organizationIds: FieldValue.arrayUnion(organizationId),
                    updatedAt: new Date(),
                },
                { merge: true }
            ),
        ]);

        return NextResponse.json({ success: true, members: await listMembers(organizationId) });
    } catch (error: any) {
        const status = error.message === 'Organization owner access required' ? 403 : 400;
        return NextResponse.json({ error: error.message || 'Failed to add member' }, { status });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const organizationId = body.organizationId as string | undefined;
        const memberId = body.memberId as string | undefined;

        if (!organizationId || !memberId) {
            return NextResponse.json({ error: 'organizationId and memberId are required' }, { status: 400 });
        }

        await requireOrganizationAccess(req, organizationId, { ownerOnly: true });

        const organizationRef = adminDb.collection('organizations').doc(organizationId);
        const organizationSnap = await organizationRef.get();
        const organization = organizationSnap.data() as { ownerId: string };

        if (memberId === organization.ownerId) {
            return NextResponse.json({ error: 'Owner cannot be removed from the workspace' }, { status: 400 });
        }

        const projectMemberships = await adminDb
            .collection('projects')
            .where('organizationId', '==', organizationId)
            .where('members', 'array-contains', memberId)
            .get();

        const batch = adminDb.batch();
        batch.update(organizationRef, {
            members: FieldValue.arrayRemove(memberId),
            updatedAt: new Date(),
        });
        batch.set(
            adminDb.collection('users').doc(memberId),
            {
                organizationIds: FieldValue.arrayRemove(organizationId),
                updatedAt: new Date(),
            },
            { merge: true }
        );

        projectMemberships.forEach((projectDoc) => {
            batch.update(projectDoc.ref, {
                members: FieldValue.arrayRemove(memberId),
                updatedAt: new Date(),
            });
        });

        await batch.commit();

        return NextResponse.json({ success: true, members: await listMembers(organizationId) });
    } catch (error: any) {
        const status = error.message === 'Organization owner access required' ? 403 : 400;
        return NextResponse.json({ error: error.message || 'Failed to remove member' }, { status });
    }
}
