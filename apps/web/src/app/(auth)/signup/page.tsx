'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase';
import { Button, Input, Card } from '@/components/ui';
import { Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { GuestGuard } from '@/components/layout';

export default function SignUpPage() {
    const router = useRouter();
    const { signUp, signInWithGoogle } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            await signUp(email, password, name);
            toast.success('Account created successfully!');
            router.push('/onboarding');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);

        try {
            await signInWithGoogle();
            toast.success('Welcome!');
            router.push('/onboarding');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to sign in with Google';
            toast.error(errorMessage);
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <GuestGuard>
            <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950">
                {/* Background effects */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-b from-violet-600/10 to-transparent rounded-full blur-3xl" />
                    <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-t from-purple-600/10 to-transparent rounded-full blur-3xl" />
                </div>

                <div className="w-full max-w-md relative z-10">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <Link href="/" className="inline-flex items-center gap-2 group">
                            <div className="p-2 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                                OpenAutomate
                            </span>
                        </Link>
                    </div>

                    <Card className="border-gray-800/50 shadow-2xl">
                        <div className="text-center mb-6">
                            <h1 className="text-2xl font-bold text-white">Create your account</h1>
                            <p className="text-gray-400 mt-1">Start automating your tests today</p>
                        </div>

                        {/* Google Sign In */}
                        <Button
                            type="button"
                            variant="secondary"
                            className="w-full mb-4"
                            onClick={handleGoogleSignIn}
                            loading={googleLoading}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Continue with Google
                        </Button>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-700" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-gray-900 text-gray-500">or continue with email</span>
                            </div>
                        </div>

                        {/* Email/Password Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                type="text"
                                label="Full name"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                autoComplete="name"
                            />
                            <Input
                                type="email"
                                label="Email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                            <Input
                                type="password"
                                label="Password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                helperText="Must be at least 6 characters"
                                required
                                autoComplete="new-password"
                            />
                            <Input
                                type="password"
                                label="Confirm password"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                            />

                            <Button type="submit" className="w-full" loading={loading}>
                                Create account
                            </Button>
                        </form>

                        <p className="mt-6 text-center text-sm text-gray-400">
                            Already have an account?{' '}
                            <Link
                                href="/login"
                                className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                            >
                                Sign in
                            </Link>
                        </p>
                    </Card>
                </div>
            </div>
        </GuestGuard>
    );
}
