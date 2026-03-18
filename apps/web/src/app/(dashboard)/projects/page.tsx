'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useProjects, useProjectMutations } from '@/lib/hooks';
import { useOrganizationContext } from '@/components/layout/OrganizationProvider';
import { Card, Button, Badge, Input, Modal, ConfirmModal } from '@/components/ui';
import {
    Plus,
    FolderKanban,
    Globe,
    MoreVertical,
    Pencil,
    Trash2,
    Search,
    ExternalLink,
    Calendar,
    Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
    const { activeOrganization } = useOrganizationContext();
    const { projects, loading } = useProjects(activeOrganization?.id);
    const { deleteProject, loading: mutationLoading } = useProjectMutations();

    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Filter projects by search
    const filteredProjects = projects.filter((project) =>
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async () => {
        if (!projectToDelete) return;

        try {
            await deleteProject(projectToDelete);
            toast.success('Project deleted successfully');
            setDeleteModalOpen(false);
            setProjectToDelete(null);
        } catch (error) {
            toast.error('Failed to delete project');
        }
    };

    const formatDate = (timestamp: { seconds: number } | null) => {
        if (!timestamp) return 'N/A';
        return new Date(timestamp.seconds * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    <p className="text-gray-400">Loading projects...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Projects</h1>
                    <p className="text-gray-400 mt-1">
                        {activeOrganization
                            ? `Manage projects in ${activeOrganization.name}`
                            : 'Select a workspace to manage projects'}
                    </p>
                </div>
                <Link href="/projects/new">
                    <Button>
                        <Plus className="w-4 h-4" />
                        New Project
                    </Button>
                </Link>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Projects Grid */}
            {filteredProjects.length === 0 ? (
                <Card className="py-16">
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <FolderKanban className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-1">
                            {searchQuery ? 'No projects found' : 'No projects yet'}
                        </h3>
                        <p className="text-sm text-gray-400 mb-6 max-w-sm">
                            {searchQuery
                                ? 'Try adjusting your search query'
                                : 'Create your first project to start organizing your test automation'}
                        </p>
                        {!searchQuery && (
                            <Link href="/projects/new">
                                <Button>
                                    <Plus className="w-4 h-4" />
                                    Create Project
                                </Button>
                            </Link>
                        )}
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map((project) => (
                        <Card
                            key={project.id}
                            hover
                            className="relative group"
                        >
                            <Link href={`/projects/${project.id}`} className="block">
                                {/* Project Icon & Name */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gradient-to-br from-violet-600/20 to-purple-600/20 rounded-lg border border-violet-500/20">
                                            <FolderKanban className="w-5 h-5 text-violet-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white group-hover:text-violet-400 transition-colors">
                                                {project.name}
                                            </h3>
                                            {project.description && (
                                                <p className="text-sm text-gray-500 line-clamp-1">
                                                    {project.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Base URL */}
                                <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                                    <Globe className="w-4 h-4" />
                                    <span className="truncate">{project.baseUrl}</span>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1.5 text-gray-500">
                                        <Calendar className="w-4 h-4" />
                                        <span>{formatDate(project.createdAt)}</span>
                                    </div>
                                </div>
                            </Link>

                            {/* Actions Menu */}
                            <div className="absolute top-4 right-4">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setOpenMenuId(openMenuId === project.id ? null : project.id);
                                    }}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>

                                {openMenuId === project.id && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setOpenMenuId(null)}
                                        />
                                        <div className="absolute right-0 top-8 z-20 w-40 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden">
                                            <Link
                                                href={`/projects/${project.id}`}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                                                onClick={() => setOpenMenuId(null)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                                Edit
                                            </Link>
                                            <a
                                                href={project.baseUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                                                onClick={() => setOpenMenuId(null)}
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Open URL
                                            </a>
                                            <button
                                                onClick={() => {
                                                    setProjectToDelete(project.id);
                                                    setDeleteModalOpen(true);
                                                    setOpenMenuId(null);
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors w-full"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setProjectToDelete(null);
                }}
                onConfirm={handleDelete}
                title="Delete Project"
                description="Are you sure you want to delete this project? This will also delete all test suites, test cases, and results. This action cannot be undone."
                confirmText="Delete"
                loading={mutationLoading}
            />
        </div>
    );
}
