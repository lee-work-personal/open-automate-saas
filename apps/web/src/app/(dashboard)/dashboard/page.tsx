'use client';

import Link from 'next/link';
import { useProjects } from '@/lib/hooks';
import { useHealthStatus } from '@/lib/hooks/useHealthStatus';
import { useProjectContext } from '@/components/layout/ProjectProvider';
import { useOrganizationContext } from '@/components/layout/OrganizationProvider';
import { Card, CardHeader, Button, Badge } from '@/components/ui';
import {
    FolderKanban,
    Layers,
    FileCheck,
    Play,
    Plus,
    ArrowRight,
    TrendingUp,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Activity,
    Zap,
    Server,
} from 'lucide-react';

export default function DashboardPage() {
    const { activeOrganization } = useOrganizationContext();
    const { projects, loading: projectsLoading } = useProjects(activeOrganization?.id);
    const { health, loading: healthLoading } = useHealthStatus();
    const { suites, testCases } = useProjectContext();

    const isLoading = projectsLoading;

    const validTestCases = testCases.filter(tc => tc.status !== 'draft');
    
    // Calculate stats
    const totalProjects = projects.length;
    const totalSuites = suites.length;
    const totalTestCases = validTestCases.length;
    const activeTests = validTestCases.filter((tc) => tc.status === 'active').length;
    const draftTests = testCases.filter((tc) => tc.status === 'draft').length;

    // Priority breakdown
    const criticalTests = validTestCases.filter((tc) => tc.priority === 'critical').length;
    const highTests = validTestCases.filter((tc) => tc.priority === 'high').length;

    const stats = [
        {
            name: 'Total Projects',
            value: totalProjects,
            icon: FolderKanban,
            color: 'violet',
            href: '/projects',
        },
        {
            name: 'Test Suites',
            value: totalSuites,
            icon: Layers,
            color: 'blue',
            href: projects[0] ? `/projects/${projects[0].id}/suites` : '/projects',
        },
        {
            name: 'Test Cases',
            value: totalTestCases,
            icon: FileCheck,
            color: 'green',
            href: projects[0] ? `/projects/${projects[0].id}/test-cases` : '/projects',
        },
        {
            name: 'Execution',
            value: health?.checks.worker.online ? 'Online' : 'Offline',
            icon: Play,
            color: 'orange',
            href: projects[0] ? `/projects/${projects[0].id}/test-runs` : '/projects',
            badge: healthLoading ? 'Checking' : health?.checks.worker.state || (projects[0] ? 'Per Project' : undefined),
        },
    ];

    const getColorClasses = (color: string) => {
        const colors: Record<string, { bg: string; text: string; border: string }> = {
            violet: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
            blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
            green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
            orange: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
            red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
        };
        return colors[color] || colors.violet;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    <p className="text-gray-400">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                    <p className="text-gray-400 mt-1">
                        {activeOrganization
                            ? `Workspace: ${activeOrganization.name}`
                            : 'Select a workspace to see your testing overview.'}
                    </p>
                </div>
                <Link href="/projects/new">
                    <Button>
                        <Plus className="w-4 h-4" />
                        New Project
                    </Button>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const colorClasses = getColorClasses(stat.color);
                    return (
                        <Link key={stat.name} href={stat.href}>
                            <Card hover className="relative overflow-hidden group">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${colorClasses.bg}`}>
                                        <stat.icon className={`w-6 h-6 ${colorClasses.text}`} />
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold text-white">{stat.value}</p>
                                        <p className="text-sm text-gray-400">{stat.name}</p>
                                    </div>
                                </div>
                                {stat.badge && (
                                    <Badge variant="default" className="absolute top-3 right-3 text-xs">
                                        {stat.badge}
                                    </Badge>
                                )}
                                <div className={`absolute inset-x-0 bottom-0 h-1 ${colorClasses.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {/* Quick Actions & Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Projects */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader
                            title="Recent Projects"
                            description="Your latest test automation projects"
                            action={
                                <Link href="/projects">
                                    <Button variant="ghost" size="sm">
                                        View All
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </Link>
                            }
                        />

                        {projects.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FolderKanban className="w-8 h-8 text-gray-600" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
                                <p className="text-sm text-gray-400 mb-4 max-w-xs mx-auto">
                                    Create your first project to start automating your tests
                                </p>
                                <Link href="/projects/new">
                                    <Button>
                                        <Plus className="w-4 h-4" />
                                        Create Project
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {projects.slice(0, 4).map((project) => (
                                    <Link
                                        key={project.id}
                                        href={`/projects/${project.id}`}
                                        className="flex items-center justify-between p-4 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-violet-500/20 rounded-lg">
                                                <FolderKanban className="w-5 h-5 text-violet-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-white group-hover:text-violet-400 transition-colors">
                                                    {project.name}
                                                </h4>
                                                <p className="text-sm text-gray-500 truncate max-w-xs">
                                                    {project.baseUrl}
                                                </p>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-violet-400 transition-colors" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Quick Stats */}
                <div className="space-y-6">
                    <Card className={`${health?.checks.worker.online ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                        <CardHeader title="Worker Status" description="Background execution service health" />
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Server className={`w-4 h-4 ${health?.checks.worker.online ? 'text-emerald-400' : 'text-red-400'}`} />
                                    <span className="text-sm text-gray-300">Executor</span>
                                </div>
                                <Badge variant={health?.checks.worker.online ? 'success' : 'danger'}>
                                    {healthLoading ? 'Checking' : health?.checks.worker.state || 'Unknown'}
                                </Badge>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>Web env: {health?.checks.env.ok ? 'Ready' : 'Missing config'}</p>
                                <p>
                                    Worker heartbeat:{' '}
                                    {health?.checks.worker.heartbeatAt
                                        ? new Date(health.checks.worker.heartbeatAt).toLocaleTimeString()
                                        : 'No heartbeat yet'}
                                </p>
                                <p>Current run: {health?.checks.worker.runId || 'Idle'}</p>
                                <p>
                                    Active runs: {health?.checks.worker.activeRunCount || 0} / {health?.checks.worker.concurrencyLimit || 1}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Test Case Breakdown */}
                    <Card>
                        <CardHeader title="Test Case Status" />
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <span className="text-sm text-gray-400">Active</span>
                                </div>
                                <span className="text-sm font-medium text-white">{activeTests}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-yellow-400" />
                                    <span className="text-sm text-gray-400">Draft</span>
                                </div>
                                <span className="text-sm font-medium text-white">{draftTests}</span>
                            </div>
                            <div className="h-px bg-gray-800" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <span className="text-sm text-gray-400">Critical Priority</span>
                                </div>
                                <span className="text-sm font-medium text-white">{criticalTests}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-orange-400" />
                                    <span className="text-sm text-gray-400">High Priority</span>
                                </div>
                                <span className="text-sm font-medium text-white">{highTests}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader title="Quick Actions" />
                        <div className="space-y-2">
                            <Link href="/projects/new" className="block">
                                <Button variant="secondary" className="w-full justify-start">
                                    <Plus className="w-4 h-4" />
                                    New Project
                                </Button>
                            </Link>
                            {projects[0] && (
                                <>
                                    <Link href={`/projects/${projects[0].id}/suites`} className="block">
                                        <Button variant="ghost" className="w-full justify-start">
                                            <Layers className="w-4 h-4" />
                                            Add Test Suite
                                        </Button>
                                    </Link>
                                    <Link href={`/projects/${projects[0].id}/test-cases`} className="block">
                                        <Button variant="ghost" className="w-full justify-start">
                                            <FileCheck className="w-4 h-4" />
                                            Add Test Case
                                        </Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Execution Banner */}
            <Card className="bg-gradient-to-r from-violet-900/30 to-purple-900/30 border-violet-500/30">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                    <div className="p-4 bg-violet-500/20 rounded-2xl">
                        <Zap className="w-8 h-8 text-violet-400" />
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="text-lg font-semibold text-white mb-1">
                            Execution Is Available
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Queue runs from any suite or test case page, then inspect live logs,
                            artifacts, and reports from each project&apos;s Test Runs section.
                        </p>
                    </div>
                    {projects[0] ? (
                        <Link href={`/projects/${projects[0].id}/test-runs`}>
                            <Button variant="secondary">
                                Open Test Runs
                            </Button>
                        </Link>
                    ) : (
                        <Badge variant="info" className="shrink-0">Create a Project First</Badge>
                    )}
                </div>
            </Card>
        </div>
    );
}
