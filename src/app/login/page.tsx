"use client";

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (userEmail: string, userPass: string) => {
    setIsLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email: userEmail,
        password: userPass,
      });

      if (res?.error) {
        setError('Invalid email or password');
      } else {
        localStorage.removeItem("mmos_active_role");
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred during sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-canvas text-ink relative overflow-hidden font-sans p-6">
      <div className="w-full max-w-md bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden relative z-10">
        
        {/* Main Login Form */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight font-display text-ink">
              Master Moves <span className="text-forest">OS</span>
            </h1>
            <p className="text-xs tracking-widest text-muted-custom uppercase font-semibold mt-1">
              Academy Management Console
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-hot-custom text-xs font-semibold rounded-lg p-3 text-center mb-6">
              ⚠ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-muted-custom uppercase">
                Account Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white border border-line rounded-lg px-3 py-2.5 text-sm text-ink focus:border-forest outline-none transition-all"
                placeholder="you@mastermoves.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-muted-custom uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white border border-line rounded-lg px-3 py-2.5 text-sm text-ink focus:border-forest outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 bg-forest hover:bg-forest/90 text-white font-bold py-3 rounded-lg text-sm transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {isLoading ? 'Authenticating Credentials...' : 'Sign In To Console'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
