'use client';

import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Mail, Plus, RefreshCcw, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/lib/firebase';
import { useOrganizationContext } from '@/components/layout/OrganizationProvider';

interface OrganizationMember {
    id: string;
    email: string;
    displayName: string;
    role: 'owner' | 'member';
}

export default function WorkspaceSettingsPage() {
    const { user } = useAuth();
    const {
        organizations,
        activeOrganization,
        activeOrganizationId,
        switching,
        switchOrganization,
        createOrganization,
        updateOrganization,
    } = useOrganizationContext();

    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceSlug, setWorkspaceSlug] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);

    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [createLoading, setCreateLoading] = useState(false);

    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(true);
    const [memberMutationLoading, setMemberMutationLoading] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');

    const isOwner = !!user && !!activeOrganization && activeOrganization.ownerId === user.uid;

    useEffect(() => {
        setWorkspaceName(activeOrganization?.name || '');
        setWorkspaceSlug(activeOrganization?.slug || '');
    }, [activeOrganization]);

    const loadMembers = async () => {
        if (!user || !activeOrganizationId) {
            setMembers([]);
            setMembersLoading(false);
            return;
        }

        setMembersLoading(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/organizations/members?organizationId=${activeOrganizationId}`, {
                headers: {
                    Authorization: `Bearer ${idToken}`,
                },
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load workspace members');
            }

            setMembers(payload.members || []);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load workspace members');
        } finally {
            setMembersLoading(false);
        }
    };

    useEffect(() => {
        void loadMembers();
    }, [activeOrganizationId, user]);

    const handleWorkspaceSave = async () => {
        if (!activeOrganizationId) return;
        if (!isOwner) {
            toast.error('Only workspace owners can update workspace details');
            return;
        }

        if (!workspaceName.trim()) {
            toast.error('Workspace name is required');
            return;
        }

        setSaveLoading(true);
        try {
            await updateOrganization(activeOrganizationId, {
                name: workspaceName.trim(),
                slug: workspaceSlug.trim(),
            });
            toast.success('Workspace updated');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update workspace');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleCreateWorkspace = async () => {
        if (!newWorkspaceName.trim()) {
            toast.error('Workspace name is required');
            return;
        }

        setCreateLoading(true);
        try {
            await createOrganization({ name: newWorkspaceName.trim() });
            setNewWorkspaceName('');
            toast.success('Workspace created');
        } catch (error: any) {
            toast.error(error.message || 'Failed to create workspace');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleAddMember = async () => {
        if (!user || !activeOrganizationId) return;
        if (!isOwner) {
            toast.error('Only workspace owners can manage members');
            return;
        }

        const email = inviteEmail.trim().toLowerCase();
        if (!email) {
            toast.error('Email is required');
            return;
        }

        setMemberMutationLoading(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/organizations/members', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ organizationId: activeOrganizationId, email }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Failed to add member');
            }

            setMembers(payload.members || []);
            setInviteEmail('');
            toast.success('Workspace member added');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add member');
        } finally {
            setMemberMutationLoading(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!user || !activeOrganizationId) return;
        if (!isOwner) {
            toast.error('Only workspace owners can manage members');
            return;
        }

        setMemberMutationLoading(true);
        try {
            const idToken = await user.getIdToken();
            const response = await fetch('/api/organizations/members', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ organizationId: activeOrganizationId, memberId }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Failed to remove member');
            }

            setMembers(payload.members || []);
            toast.success('Workspace member removed');
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove member');
        } finally {
            setMemberMutationLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Workspace Settings</h1>
                <p className="mt-1 text-gray-400">
                    Manage workspaces, teammates, and the active tenant used across this hosted instance.
                </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="p-6">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                                <Building2 className="h-5 w-5 text-cyan-400" />
                                Current Workspace
                            </h2>
                            <p className="mt-1 text-sm text-gray-400">
                                Rename the active workspace and keep its slug clean for future SaaS URLs and billing.
                            </p>
                        </div>
                        {activeOrganization ? (
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                                Active
                            </span>
                        ) : null}
                    </div>

                    {!activeOrganization ? (
                        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/30 p-8 text-sm text-gray-400">
                            No workspace selected. Create a workspace below to start using the SaaS environment.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Input
                                label="Workspace Name"
                                value={workspaceName}
                                onChange={(event) => setWorkspaceName(event.target.value)}
                                placeholder="QA Team"
                                disabled={!isOwner}
                            />
                            <Input
                                label="Workspace Slug"
                                value={workspaceSlug}
                                onChange={(event) => setWorkspaceSlug(event.target.value)}
                                placeholder="qa-team"
                                helperText="Used for future hosted routing, billing, and audit references."
                                disabled={!isOwner}
                            />
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                                <div className="text-sm text-gray-400">
                                    {isOwner
                                        ? 'You own this workspace and can manage teammates and settings.'
                                        : 'You are a workspace member. Only the owner can change workspace settings.'}
                                </div>
                                <Button onClick={handleWorkspaceSave} loading={saveLoading} disabled={!isOwner}>
                                    Save Workspace
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>

                <Card className="p-6">
                    <div className="mb-6">
                        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                            <Plus className="h-5 w-5 text-violet-400" />
                            Create Workspace
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                            Use multiple workspaces when you want isolated clients, teams, or environments inside the SaaS app.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Input
                            label="New Workspace Name"
                            value={newWorkspaceName}
                            onChange={(event) => setNewWorkspaceName(event.target.value)}
                            placeholder="Acme QA"
                        />
                        <Button className="w-full" onClick={handleCreateWorkspace} loading={createLoading}>
                            Create Workspace
                        </Button>
                    </div>

                    <div className="mt-6 border-t border-gray-800 pt-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Your Workspaces</h3>
                        <div className="mt-3 space-y-2">
                            {organizations.map((organization) => {
                                const isCurrent = organization.id === activeOrganizationId;
                                const isOwned = organization.ownerId === user?.uid;

                                return (
                                    <div key={organization.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/40 p-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-medium text-white">
                                                {organization.name}
                                                {isOwned ? (
                                                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">
                                                        Owner
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="text-xs text-gray-500">{organization.slug}</div>
                                        </div>
                                        {isCurrent ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Current
                                            </span>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => void switchOrganization(organization.id)}
                                                disabled={switching}
                                            >
                                                <RefreshCcw className="mr-2 h-4 w-4" />
                                                Switch
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="p-6">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                            <Users className="h-5 w-5 text-violet-400" />
                            Workspace Members
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                            Workspace membership controls tenant access. Project access should only be granted to workspace members.
                        </p>
                    </div>
                </div>

                {isOwner ? (
                    <div className="mb-6 flex flex-col gap-3 md:flex-row">
                        <Input
                            value={inviteEmail}
                            onChange={(event) => setInviteEmail(event.target.value)}
                            placeholder="teammate@example.com"
                            className="flex-1"
                        />
                        <Button onClick={handleAddMember} loading={memberMutationLoading}>
                            <Mail className="mr-2 h-4 w-4" />
                            Add Member
                        </Button>
                    </div>
                ) : (
                    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/30 p-4 text-sm text-gray-400">
                        Only the workspace owner can invite or remove members.
                    </div>
                )}

                <div className="space-y-2">
                    {membersLoading ? (
                        <div className="py-8 text-center text-gray-500">Loading workspace members...</div>
                    ) : members.length === 0 ? (
                        <div className="py-8 text-center text-gray-500">No workspace members found.</div>
                    ) : (
                        members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                                <div>
                                    <div className="text-sm font-medium text-white">{member.displayName || member.email}</div>
                                    <div className="text-xs text-gray-400">{member.email}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${member.role === 'owner' ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-gray-700 bg-gray-800 text-gray-300'}`}>
                                        {member.role}
                                    </span>
                                    {isOwner && member.role !== 'owner' ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-400 hover:text-red-300"
                                            disabled={memberMutationLoading}
                                            onClick={() => handleRemoveMember(member.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
}
