'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Plus, Pencil, Trash2, Users, Shield, Mail, X } from 'lucide-react';
import { useProject, useProjectVariables, useProjectVariableMutations } from '@/lib/hooks';
import { Card, Button, Input, Modal, ConfirmModal } from '@/components/ui';
import { useAuth } from '@/lib/firebase';
import { canEditProject } from '@/lib/project-permissions';
import toast from 'react-hot-toast';

interface ProjectMember {
    id: string;
    email: string;
    displayName: string;
    role: 'owner' | 'viewer';
}

export default function ProjectSettingsPage() {
    const params = useParams();
    const projectId = params.projectId as string;
    const { project } = useProject(projectId);
    const { user } = useAuth();
    const { variables, loading } = useProjectVariables(projectId);
    const { createVariable, updateVariable, deleteVariable, loading: mutationLoading } = useProjectVariableMutations();
    const isOwner = canEditProject(project, user);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedVariableId, setSelectedVariableId] = useState<string | null>(null);
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [membersMutationLoading, setMembersMutationLoading] = useState(false);

    // Form State
    const [formKey, setFormKey] = useState('');
    const [formValue, setFormValue] = useState('');
    const [formSecret, setFormSecret] = useState(false);
    const [formDescription, setFormDescription] = useState('');

    const resetForm = () => {
        setFormKey('');
        setFormValue('');
        setFormSecret(false);
        setFormDescription('');
    };

    const loadMembers = async () => {
        try {
            const idToken = await user?.getIdToken();
            if (!idToken) {
                setMembers([]);
                setMembersLoading(false);
                return;
            }

            const response = await fetch(`/api/projects/members?projectId=${projectId}`, {
                headers: {
                    Authorization: `Bearer ${idToken}`,
                },
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Failed to load members');
            }

            setMembers(payload.members || []);
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to load members');
        } finally {
            setMembersLoading(false);
        }
    };

    useEffect(() => {
        if (!projectId || !user) return;
        loadMembers();
    }, [projectId, user]);

    const handleCreate = async () => {
        if (!isOwner) {
            toast.error('Only project owners can manage variables');
            return;
        }
        if (!formKey.trim() || !formValue.trim()) {
            toast.error('Key and Value are required');
            return;
        }

        try {
            await createVariable({
                projectId,
                key: formKey.toUpperCase().replace(/\s+/g, '_'), // Normalize keys
                value: formValue,
                isSecret: formSecret,
                description: formDescription
            });
            toast.success('Variable created');
            setIsCreateModalOpen(false);
            resetForm();
        } catch (error) {
            toast.error('Failed to create variable');
        }
    };

    const handleUpdate = async () => {
        if (!isOwner) {
            toast.error('Only project owners can manage variables');
            return;
        }
        if (!selectedVariableId || !formKey.trim()) return;

        try {
            await updateVariable(selectedVariableId, {
                key: formKey.toUpperCase().replace(/\s+/g, '_'),
                value: formValue,
                isSecret: formSecret,
                description: formDescription
            });
            toast.success('Variable updated');
            setIsEditModalOpen(false);
            resetForm();
            setSelectedVariableId(null);
        } catch (error) {
            toast.error('Failed to update variable');
        }
    };

    const handleDelete = async () => {
        if (!isOwner) {
            toast.error('Only project owners can manage variables');
            return;
        }
        if (!selectedVariableId) return;
        try {
            await deleteVariable(selectedVariableId);
            toast.success('Variable deleted');
            setDeleteModalOpen(false);
            setSelectedVariableId(null);
        } catch (error) {
            toast.error('Failed to delete variable');
        }
    };

    const openEditModal = (v: any) => {
        if (!isOwner) return;
        setSelectedVariableId(v.id);
        setFormKey(v.key);
        setFormValue(v.value);
        setFormSecret(v.isSecret);
        setFormDescription(v.description || '');
        setIsEditModalOpen(true);
    };

    const handleAddMember = async () => {
        if (!isOwner) {
            toast.error('Only project owners can manage members');
            return;
        }

        const email = inviteEmail.trim().toLowerCase();
        if (!email) {
            toast.error('Email is required');
            return;
        }

        setMembersMutationLoading(true);
        try {
            const idToken = await user?.getIdToken();
            if (!idToken) throw new Error('Not authenticated');

            const response = await fetch('/api/projects/members', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ projectId, email }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to add member');
            }

            setMembers(payload.members || []);
            setInviteEmail('');
            toast.success('Member added');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to add member');
        } finally {
            setMembersMutationLoading(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!isOwner) {
            toast.error('Only project owners can manage members');
            return;
        }

        setMembersMutationLoading(true);
        try {
            const idToken = await user?.getIdToken();
            if (!idToken) throw new Error('Not authenticated');

            const response = await fetch('/api/projects/members', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ projectId, memberId }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || 'Failed to remove member');
            }

            setMembers(payload.members || []);
            toast.success('Member removed');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to remove member');
        } finally {
            setMembersMutationLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
                <Link href="/projects" className="text-gray-400 hover:text-white transition-colors">Projects</Link>
                <ChevronRight className="w-4 h-4 text-gray-600" />
                <Link href={`/projects/${projectId}`} className="text-gray-400 hover:text-white transition-colors">{project?.name || 'Project'}</Link>
                <ChevronRight className="w-4 h-4 text-gray-600" />
                <span className="text-white">Settings</span>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Project Settings</h1>
                    <p className="text-gray-400 mt-1">Manage team access, variables, and configuration</p>
                </div>
            </div>

            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-violet-400" />
                            Team Access
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Owners can edit and run tests. Viewers can inspect projects, runs, and artifacts. Users must already belong to the workspace before they can be added here.
                        </p>
                    </div>
                </div>

                {isOwner && (
                    <div className="flex flex-col md:flex-row gap-3 mb-6">
                        <Input
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="teammate@example.com"
                            className="flex-1"
                        />
                        <Button onClick={handleAddMember} loading={membersMutationLoading}>
                            <Mail className="w-4 h-4 mr-2" />
                            Add Viewer
                        </Button>
                    </div>
                )}

                <div className="space-y-2">
                    {membersLoading ? (
                        <div className="text-center py-8 text-gray-500">Loading members...</div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No members found.</div>
                    ) : (
                        members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
                                <div>
                                    <div className="text-sm font-medium text-white">
                                        {member.displayName || member.email}
                                    </div>
                                    <div className="text-xs text-gray-400">{member.email}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${member.role === 'owner' ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}>
                                        <Shield className="w-3 h-3" />
                                        {member.role}
                                    </span>
                                    {isOwner && member.role !== 'owner' && (
                                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => handleRemoveMember(member.id)} disabled={membersMutationLoading}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {/* Variables Section */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Variables</h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Use these variable in your tests as <code className="bg-gray-800 px-1 py-0.5 rounded text-violet-300">{'{{VARIABLE_NAME}}'}</code>
                        </p>
                    </div>
                    {isOwner ? (
                        <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Variable
                        </Button>
                    ) : (
                        <span className="text-xs text-gray-500">Read only for viewers</span>
                    )}
                </div>

                <div className="space-y-2">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading variables...</div>
                    ) : variables.length === 0 ? (
                        <div className="text-center py-12 bg-gray-900/50 rounded-lg border border-gray-800 border-dashed">
                            <p className="text-gray-400">No variables defined yet.</p>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {variables.map((v) => (
                                <div key={v.id} className="flex items-center justify-between p-4 bg-gray-900/50 border border-gray-800 rounded-lg group hover:border-gray-700 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="font-mono text-sm font-bold text-violet-400 bg-violet-500/10 px-2 py-1 rounded">
                                            {v.key}
                                        </div>
                                        {v.description && (
                                            <span className="text-sm text-gray-500 border-l border-gray-700 pl-4">
                                                {v.description}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-sm text-gray-300 font-mono">
                                            {v.isSecret ? '••••••••' : v.value}
                                        </div>
                                        {isOwner && (
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" onClick={() => openEditModal(v)}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => { setSelectedVariableId(v.id); setDeleteModalOpen(true); }}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isOwner && (isCreateModalOpen || isEditModalOpen)}
                onClose={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}
                title={isEditModalOpen ? 'Edit Variable' : 'Add Variable'}
            >
                <div className="space-y-4">
                    <Input
                        label="Key"
                        placeholder="e.g. USER_EMAIL"
                        value={formKey}
                        onChange={(e) => setFormKey(e.target.value.toUpperCase())}
                        helperText="Will be converted to UPPERCASE_WITH_UNDERSCORES"
                    />
                    <div>
                        <Input
                            label="Value"
                            placeholder="Value"
                            type={formSecret ? "password" : "text"}
                            value={formValue}
                            onChange={(e) => setFormValue(e.target.value)}
                        />
                        <div className="flex items-center gap-2 mt-2">
                            <input
                                type="checkbox"
                                id="isSecret"
                                checked={formSecret}
                                onChange={(e) => setFormSecret(e.target.checked)}
                                className="rounded bg-gray-800 border-gray-700 text-violet-500 focus:ring-violet-500"
                            />
                            <label htmlFor="isSecret" className="text-sm text-gray-300 cursor-pointer select-none">
                                Mark as secret (masked in UI)
                            </label>
                        </div>
                    </div>
                    <Input
                        label="Description"
                        placeholder="Optional description"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => { setIsCreateModalOpen(false); setIsEditModalOpen(false); }}>Cancel</Button>
                        <Button onClick={isEditModalOpen ? handleUpdate : handleCreate} loading={mutationLoading}>
                            {isEditModalOpen ? 'Save Changes' : 'Create Variable'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Modal */}
            <ConfirmModal
                isOpen={isOwner && deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Variable"
                description={`Are you sure you want to delete variable ${variables.find(v => v.id === selectedVariableId)?.key}?`}
                confirmText="Delete"
                loading={mutationLoading}
            />
        </div>
    );
}
