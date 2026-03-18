/**
 * OpenAutomate - Constants
 * Shared constants for the web application
 */

// Firestore Collection Names
export const COLLECTIONS = {
    USERS: 'users',
    ORGANIZATIONS: 'organizations',
    PROJECTS: 'projects',
    TEST_SUITES: 'testSuites',
    TEST_CASES: 'testCases',
    TEST_RUNS: 'testRuns',
    TEST_RESULTS: 'testResults',
    FEATURES: 'features',
    VARIABLES: 'variables',
} as const;

// Default Project Settings
export const DEFAULT_PROJECT_SETTINGS = {
    defaultBrowser: 'chromium' as const,
    defaultViewport: { width: 1280, height: 720 },
    screenshotOnFailure: true,
    videoRecording: false,
};

// Test Priorities with display info
export const TEST_PRIORITIES = [
    { value: 'critical', label: 'Critical', color: '#ef4444' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'medium', label: 'Medium', color: '#eab308' },
    { value: 'low', label: 'Low', color: '#22c55e' },
] as const;

// Test Case Statuses
export const TEST_STATUSES = [
    { value: 'draft', label: 'Draft', color: '#6b7280' },
    { value: 'active', label: 'Active', color: '#22c55e' },
    { value: 'deprecated', label: 'Deprecated', color: '#ef4444' },
] as const;

// Run Statuses
export const RUN_STATUSES = [
    { value: 'queued', label: 'Queued', color: '#6b7280' },
    { value: 'running', label: 'Running', color: '#3b82f6' },
    { value: 'completed', label: 'Completed', color: '#22c55e' },
    { value: 'cancelled', label: 'Cancelled', color: '#f97316' },
    { value: 'failed', label: 'Failed', color: '#ef4444' },
] as const;

// Browsers
export const BROWSERS = [
    { value: 'chromium', label: 'Chrome', icon: 'chrome' },
    { value: 'firefox', label: 'Firefox', icon: 'firefox' },
    { value: 'webkit', label: 'Safari', icon: 'safari' },
] as const;

// Common Viewport Presets
export const VIEWPORT_PRESETS = [
    { name: 'Desktop HD', width: 1920, height: 1080 },
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Laptop', width: 1366, height: 768 },
    { name: 'Tablet (Landscape)', width: 1024, height: 768 },
    { name: 'Tablet (Portrait)', width: 768, height: 1024 },
    { name: 'Mobile (Large)', width: 414, height: 896 },
    { name: 'Mobile (Medium)', width: 375, height: 812 },
    { name: 'Mobile (Small)', width: 320, height: 568 },
] as const;

// Navigation items for sidebar
export const NAV_ITEMS = [
    { name: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { name: 'Projects', href: '/projects', icon: 'FolderKanban' },
    { name: 'Test Suites', href: '/suites', icon: 'Layers' },
    { name: 'Test Cases', href: '/test-cases', icon: 'FileCheck' },
    { name: 'Test Runs', href: '/runs', icon: 'Play' },
    { name: 'Reports', href: '/reports', icon: 'BarChart3' },
] as const;
