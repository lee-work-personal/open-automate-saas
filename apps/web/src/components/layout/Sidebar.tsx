'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { clsx } from 'clsx';
import {
    Zap,
    LayoutDashboard,
    FolderKanban,
    Layers,
    FileCheck,
    Play,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronDown,
    ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase';
import { Button, Select } from '@/components/ui';
import { useOrganizationContext } from './OrganizationProvider';

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const params = useParams();
    const { user, signOut } = useAuth();
    const {
        organizations,
        activeOrganizationId,
        switchOrganization,
        switching,
    } = useOrganizationContext();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const projectId = params?.projectId as string | undefined;
    const isSaaSAdmin = !!user?.email && (process.env.NEXT_PUBLIC_OPENAUTOMATE_SAAS_ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
        .includes(user.email.toLowerCase());

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, global: true },
        { name: 'Projects', href: '/projects', icon: FolderKanban, global: true },
        ...(isSaaSAdmin ? [{ name: 'SaaS Admin', href: '/admin', icon: ShieldCheck, global: true }] : []),
    ];

    const projectNavigation = projectId ? [
        { name: 'Overview', href: `/projects/${projectId}`, icon: LayoutDashboard },
        { name: 'Test Suites', href: `/projects/${projectId}/suites`, icon: Layers },
        { name: 'Test Cases', href: `/projects/${projectId}/test-cases`, icon: FileCheck },
        { name: 'Test Runs', href: `/projects/${projectId}/test-runs`, icon: Play },
        { name: 'Reports', href: `/projects/${projectId}/reports`, icon: BarChart3 },
        { name: 'Settings', href: `/projects/${projectId}/settings`, icon: Settings },
    ] : [];

    const handleSignOut = async () => {
        await signOut();
        router.push('/login');
    };

    const NavContent = () => (
        <>
            {/* Logo */}
            <div className="flex items-center gap-2 px-4 py-6">
                <div className="p-2 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
                    <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    OpenAutomate
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1">
                <div className="px-3 pb-4">
                    <Select
                        label="Workspace"
                        value={activeOrganizationId || ''}
                        onChange={(event) => void switchOrganization(event.target.value)}
                        disabled={switching || organizations.length === 0}
                        options={organizations.map((organization) => ({
                            value: organization.id,
                            label: organization.name,
                        }))}
                    />
                </div>
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                                isActive
                                    ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 text-white border border-violet-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            )}
                        >
                            <item.icon className={clsx('w-5 h-5', isActive && 'text-violet-400')} />
                            {item.name}
                        </Link>
                    );
                })}

                {projectId && (
                    <div className="pt-6 mt-6 border-t border-gray-800">
                        <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Project
                        </p>
                        <div className="space-y-1">
                            {projectNavigation.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        className={clsx(
                                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                                            isActive
                                                ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 text-white border border-violet-500/30'
                                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                        )}
                                    >
                                        <item.icon className={clsx('w-5 h-5', isActive && 'text-violet-400')} />
                                        {item.name}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </nav>

            {/* User Menu */}
            <div className="px-3 py-4 border-t border-gray-800">
                <div className="relative">
                    <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
                    >
                        <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 text-left">
                            <div className="text-sm font-medium text-white truncate">
                                {user?.displayName || 'User'}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                {user?.email}
                            </div>
                        </div>
                        <ChevronDown className={clsx('w-4 h-4 transition-transform', userMenuOpen && 'rotate-180')} />
                    </button>

                    {userMenuOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden">
                            <Link
                                href="/settings"
                                onClick={() => {
                                    setUserMenuOpen(false);
                                    setMobileOpen(false);
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                                Settings
                            </Link>
                            <button
                                onClick={handleSignOut}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile menu button */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-violet-600 to-purple-600 rounded-lg">
                            <Zap className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-lg font-bold text-white">OpenAutomate</span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                </div>
            </div>

            {/* Mobile sidebar overlay */}
            {mobileOpen && (
                <div
                    className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Mobile sidebar */}
            <div
                className={clsx(
                    'lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-gray-950 border-r border-gray-800 transform transition-transform duration-300',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex flex-col h-full">
                    <NavContent />
                </div>
            </div>

            {/* Desktop sidebar */}
            <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:bg-gray-950 lg:border-r lg:border-gray-800">
                <NavContent />
            </div>
        </>
    );
}
