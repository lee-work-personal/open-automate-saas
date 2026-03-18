'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { Card, CardHeader, Badge } from '@/components/ui';
import { Building2, CreditCard, FolderKanban, PlayCircle, Users } from 'lucide-react';

interface AdminOverview {
    summary: {
        organizationCount: number;
        projectCount: number;
        runCount: number;
        activeOrganizations: number;
    };
    organizations: Array<{
        id: string;
        name: string;
        ownerEmail: string | null;
        ownerName: string | null;
        memberCount: number;
        projectCount: number;
        runCount: number;
        plan: string;
        billingStatus: string;
        lastActivityAt: number | null;
    }>;
}

export default function AdminPage() {
    const [overview, setOverview] = useState<AdminOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                const response = await fetch('/api/admin/overview', {
                    headers: token ? { authorization: `Bearer ${token}` } : {},
                    cache: 'no-store',
                });
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload.error || 'Failed to load admin overview');
                }
                if (!cancelled) {
                    setOverview(payload);
                    setError(null);
                }
            } catch (loadError: any) {
                if (!cancelled) {
                    setError(loadError.message || 'Failed to load admin overview');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return <div className="text-gray-400">Loading SaaS admin overview...</div>;
    }

    if (error) {
        return <div className="text-red-400">{error}</div>;
    }

    if (!overview) {
        return <div className="text-gray-400">No overview data available.</div>;
    }

    const summaryCards = [
        { label: 'Clients', value: overview.summary.organizationCount, icon: Building2 },
        { label: 'Projects', value: overview.summary.projectCount, icon: FolderKanban },
        { label: 'Runs', value: overview.summary.runCount, icon: PlayCircle },
        { label: 'Active Clients', value: overview.summary.activeOrganizations, icon: Users },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">SaaS Admin</h1>
                <p className="mt-1 text-gray-400">Track client workspaces, usage, and billing readiness.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                    <Card key={card.label}>
                        <div className="flex items-center gap-4">
                            <div className="rounded-xl bg-cyan-500/10 p-3">
                                <card.icon className="h-5 w-5 text-cyan-300" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">{card.label}</p>
                                <p className="text-3xl font-bold text-white">{card.value}</p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader
                    title="Client Workspaces"
                    description="Usage snapshot for each organization in the SaaS environment"
                    action={<Badge variant="info">{overview.organizations.length} tenants</Badge>}
                />
                <div className="space-y-3">
                    {overview.organizations.map((organization) => (
                        <div key={organization.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold text-white">{organization.name}</h3>
                                        <Badge variant={organization.billingStatus === 'active' ? 'success' : 'default'}>
                                            {organization.billingStatus}
                                        </Badge>
                                        <Badge variant="default">{organization.plan}</Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-400">
                                        Owner: {organization.ownerName || 'Unknown'} {organization.ownerEmail ? `(${organization.ownerEmail})` : ''}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[320px] lg:grid-cols-4">
                                    <div className="rounded-lg bg-black/20 p-3">
                                        <p className="text-gray-500">Members</p>
                                        <p className="mt-1 text-xl font-semibold text-white">{organization.memberCount}</p>
                                    </div>
                                    <div className="rounded-lg bg-black/20 p-3">
                                        <p className="text-gray-500">Projects</p>
                                        <p className="mt-1 text-xl font-semibold text-white">{organization.projectCount}</p>
                                    </div>
                                    <div className="rounded-lg bg-black/20 p-3">
                                        <p className="text-gray-500">Runs</p>
                                        <p className="mt-1 text-xl font-semibold text-white">{organization.runCount}</p>
                                    </div>
                                    <div className="rounded-lg bg-black/20 p-3">
                                        <p className="text-gray-500">Last Activity</p>
                                        <p className="mt-1 text-sm font-semibold text-white">
                                            {organization.lastActivityAt ? new Date(organization.lastActivityAt).toLocaleDateString() : 'No activity'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                                <CreditCard className="h-3.5 w-3.5" />
                                Billing hook is ready through the `plan` and `billingStatus` fields on the organization record.
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
