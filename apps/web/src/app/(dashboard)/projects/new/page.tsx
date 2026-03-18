'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjectMutations } from '@/lib/hooks';
import { Card, Button, Input } from '@/components/ui';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOrganizationContext } from '@/components/layout/OrganizationProvider';

export default function NewProjectPage() {
    const router = useRouter();
    const { createProject, loading } = useProjectMutations();
    const { activeOrganization } = useOrganizationContext();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) {
            newErrors.name = 'Project name is required';
        }

        if (!baseUrl.trim()) {
            newErrors.baseUrl = 'Base URL is required';
        } else {
            try {
                new URL(baseUrl);
            } catch {
                newErrors.baseUrl = 'Please enter a valid URL';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        try {
            const projectId = await createProject({
                name: name.trim(),
                description: description.trim(),
                baseUrl: baseUrl.trim(),
            });

            toast.success('Project created successfully!');
            router.push(`/projects/${projectId}`);
        } catch (error) {
            toast.error('Failed to create project');
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            {/* Back Link */}
            <Link
                href="/projects"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Projects
            </Link>

            <Card>
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl">
                        <FolderKanban className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Create New Project</h1>
                        <p className="text-gray-400">
                            Set up a new test automation project
                            {activeOrganization ? ` in ${activeOrganization.name}` : ''}
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Project Name"
                        placeholder="My Web Application"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={errors.name}
                        required
                    />

                    <Input
                        label="Description"
                        placeholder="Brief description of your project (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <Input
                        label="Base URL"
                        placeholder="https://example.com"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        error={errors.baseUrl}
                        helperText="The root URL of your application for testing"
                        required
                    />

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
                        <Button type="submit" loading={loading}>
                            Create Project
                        </Button>
                        <Link href="/projects">
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </Link>
                    </div>
                </form>
            </Card>
        </div>
    );
}
