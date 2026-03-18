'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase';
import { Sidebar } from './Sidebar';
import { ProjectProvider } from './ProjectProvider';
import { OrganizationProvider } from './OrganizationProvider';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    // Show loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                    <p className="text-gray-400">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render if not authenticated
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-950">
            <OrganizationProvider>
                <Sidebar />

                {/* Main content */}
                <main className="lg:pl-64 pt-16 lg:pt-0">
                    <div className="px-4 sm:px-6 lg:px-8 py-8">
                        <ProjectProvider>
                            {children}
                        </ProjectProvider>
                    </div>
                </main>
            </OrganizationProvider>
        </div>
    );
}
