'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, FolderKanban, Rocket, Sparkles, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/lib/firebase';
import { useProjectMutations, useProjects } from '@/lib/hooks';
import { useOrganizationContext } from '@/components/layout/OrganizationProvider';

export default function OnboardingPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { activeOrganization, switchOrganization, createOrganization, updateOrganization, switching } = useOrganizationContext();
    const { projects, loading: projectsLoading } = useProjects(activeOrganization?.id);
    const { createProject, loading: projectLoading } = useProjectMutations();

    const [workspaceName, setWorkspaceName] = useState('');
    const [workspaceSlug, setWorkspaceSlug] = useState('');
    const [workspaceSaving, setWorkspaceSaving] = useState(false);

    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [workspaceCreating, setWorkspaceCreating] = useState(false);

    const [projectName, setProjectName] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [projectBaseUrl, setProjectBaseUrl] = useState('');

    useEffect(() => {
        if (!activeOrganization) return;
        setWorkspaceName(activeOrganization.name || '');
        setWorkspaceSlug(activeOrganization.slug || '');
    }, [activeOrganization]);

    const hasProjects = projects.length > 0;
    const workspaceLabel = activeOrganization?.name || 'your workspace';
    const suggestedBaseUrl = useMemo(() => {
        if (!activeOrganization?.slug) return 'https://app.example.com';
        return `https://${activeOrganization.slug}.example.com`;
    }, [activeOrganization?.slug]);

    const handleWorkspaceSave = async () => {
        if (!activeOrganization?.id) return;
        if (!workspaceName.trim()) {
            toast.error('Workspace name is required');
            return;
        }

        setWorkspaceSaving(true);
        try {
            await updateOrganization(activeOrganization.id, {
                name: workspaceName.trim(),
                slug: workspaceSlug.trim(),
            });
            toast.success('Workspace updated');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update workspace');
        } finally {
            setWorkspaceSaving(false);
        }
    };

    const handleWorkspaceCreate = async () => {
        if (!newWorkspaceName.trim()) {
            toast.error('Workspace name is required');
            return;
        }

        setWorkspaceCreating(true);
        try {
            const organizationId = await createOrganization({ name: newWorkspaceName.trim() });
            await switchOrganization(organizationId);
            setNewWorkspaceName('');
            toast.success('Workspace created');
        } catch (error: any) {
            toast.error(error.message || 'Failed to create workspace');
        } finally {
            setWorkspaceCreating(false);
        }
    };

    const handleCreateProject = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!projectName.trim()) {
            toast.error('Project name is required');
            return;
        }

        if (!projectBaseUrl.trim()) {
            toast.error('Base URL is required');
            return;
        }

        try {
            new URL(projectBaseUrl.trim());
        } catch {
            toast.error('Enter a valid base URL');
            return;
        }

        try {
            const projectId = await createProject({
                name: projectName.trim(),
                description: projectDescription.trim(),
                baseUrl: projectBaseUrl.trim(),
            });
            toast.success('First project created');
            router.push(`/projects/${projectId}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to create project');
        }
    };

    if (projectsLoading || !activeOrganization) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-500/30 border-t-violet-500" />
                    <p className="text-gray-400">Preparing your workspace...</p>
                </div>
            </div>
        );
    }

    if (hasProjects) {
        return (
            <div className="mx-auto max-w-4xl space-y-6">
                <Card className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-gray-900 to-gray-950 p-8">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Setup Complete
                            </div>
                            <h1 className="text-3xl font-bold text-white">Your SaaS workspace is ready</h1>
                            <p className="mt-2 max-w-2xl text-gray-300">
                                {workspaceLabel} already has a project, so the tenant setup is complete. Next, add suites, test cases,
                                and teammates as needed.
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link href="/dashboard">
                                <Button>
                                    Go to Dashboard
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/settings">
                                <Button variant="outline">Manage Workspace</Button>
                            </Link>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-8">
            <Card className="overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-gray-950 to-cyan-950 p-8">
                <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-violet-300">
                            <Sparkles className="h-3.5 w-3.5" />
                            Hosted Setup
                        </div>
                        <h1 className="text-4xl font-bold text-white">Welcome, {user?.displayName || user?.email?.split('@')[0] || 'there'}</h1>
                        <p className="mt-3 max-w-2xl text-gray-300">
                            OpenAutomate Cloud gives each client or team its own workspace. This onboarding flow gets your first workspace
                            and first project ready in a couple of minutes.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">What happens next</p>
                        <div className="mt-4 space-y-3 text-sm text-gray-300">
                            <div className="flex items-start gap-3">
                                <Building2 className="mt-0.5 h-4 w-4 text-cyan-400" />
                                <span>Name the workspace your team or client will use.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <FolderKanban className="mt-0.5 h-4 w-4 text-violet-400" />
                                <span>Create the first project that will hold suites, test cases, runs, and reports.</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <Users className="mt-0.5 h-4 w-4 text-emerald-400" />
                                <span>Invite teammates later from Workspace Settings when you are ready to collaborate.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <Card className="p-6">
                    <div className="mb-6">
                        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                            <Building2 className="h-5 w-5 text-cyan-400" />
                            Step 1: Confirm Your Workspace
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                            A personal workspace was created automatically when you signed up. Keep it, rename it, or create a new client-facing workspace.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Input
                            label="Active Workspace Name"
                            value={workspaceName}
                            onChange={(event) => setWorkspaceName(event.target.value)}
                            placeholder="Acme QA Team"
                        />
                        <Input
                            label="Workspace Slug"
                            value={workspaceSlug}
                            onChange={(event) => setWorkspaceSlug(event.target.value)}
                            placeholder="acme-qa-team"
                            helperText="This will later be useful for hosted URLs, billing, and admin reporting."
                        />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button onClick={handleWorkspaceSave} loading={workspaceSaving}>
                                Save Workspace
                            </Button>
                            <Link href="/settings">
                                <Button variant="outline">Advanced Workspace Settings</Button>
                            </Link>
                        </div>
                    </div>

                    <div className="mt-8 rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Need a separate client workspace?</h3>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <Input
                                value={newWorkspaceName}
                                onChange={(event) => setNewWorkspaceName(event.target.value)}
                                placeholder="Client Workspace"
                                className="flex-1"
                            />
                            <Button onClick={handleWorkspaceCreate} loading={workspaceCreating || switching}>
                                Create and Switch
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-6">
                        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                            <FolderKanban className="h-5 w-5 text-violet-400" />
                            Step 2: Create Your First Project
                        </h2>
                        <p className="mt-1 text-sm text-gray-400">
                            This project will live inside <span className="text-white">{workspaceLabel}</span> and become the home for suites, cases, runs, and reports.
                        </p>
                    </div>

                    <form onSubmit={handleCreateProject} className="space-y-4">
                        <Input
                            label="Project Name"
                            value={projectName}
                            onChange={(event) => setProjectName(event.target.value)}
                            placeholder="Customer Portal"
                            required
                        />
                        <Input
                            label="Base URL"
                            value={projectBaseUrl}
                            onChange={(event) => setProjectBaseUrl(event.target.value)}
                            placeholder={suggestedBaseUrl}
                            helperText="Use the root URL your Playwright flows should start from."
                            required
                        />
                        <Input
                            label="Description"
                            value={projectDescription}
                            onChange={(event) => setProjectDescription(event.target.value)}
                            placeholder="Main web app regression coverage"
                        />

                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            <Button type="submit" loading={projectLoading}>
                                <Rocket className="mr-2 h-4 w-4" />
                                Create First Project
                            </Button>
                            <Link href="/projects/new">
                                <Button type="button" variant="outline">Use Full Project Form</Button>
                            </Link>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
