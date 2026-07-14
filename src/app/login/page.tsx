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

  const demoAccounts = [
    { name: 'Amit Goyal', role: 'Owner / Admin', email: 'owner@mastermoves.com', pass: 'password123', color: 'border-brass/30 hover:border-brass text-brass bg-brass/5' },
    { name: 'Sara Miller', role: 'Front Desk', email: 'sara@mastermoves.com', pass: 'password123', color: 'border-mint/30 hover:border-mint text-mint bg-mint/5' },
    { name: 'James Estrada', role: 'Chess Coach', email: 'james@mastermoves.com', pass: 'password123', color: 'border-mint/30 hover:border-mint text-mint bg-mint/5' },
    { name: 'Robert Sterling', role: 'Parent Portal', email: 'parent@mastermoves.com', pass: 'password123', color: 'border-brass2/30 hover:border-brass2 text-brass2 bg-brass2/5' }
  ];

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-canvas text-ink relative overflow-hidden font-sans p-6">
      <div className="w-full max-w-4xl grid md:grid-cols-[1.2fr_1fr] bg-surface border border-line rounded-[14px] shadow-sm overflow-hidden relative z-10">
        
        {/* Left Pane - Main Login Form */}
        <div className="p-8 md:p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-line">
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

        {/* Right Pane - Sandbox Quick Access */}
        <div className="p-8 md:p-12 bg-fd flex flex-col justify-center text-white">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white font-display">
              Sandbox Quick Access
            </h2>
            <p className="text-xs text-mint mt-1">
              Select a pre-configured role profile to launch the dedicated console dashboard.
            </p>
          </div>

          <div className="space-y-3">
            {demoAccounts.map((acc, idx) => (
              <button
                key={idx}
                onClick={() => handleLogin(acc.email, acc.pass)}
                disabled={isLoading}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${acc.color}`}
              >
                <div>
                  <div className="text-xs font-bold text-white">{acc.name}</div>
                  <div className="text-[10px] opacity-80">{acc.role}</div>
                </div>
                <span className="text-xs opacity-75">Connect ➔</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
