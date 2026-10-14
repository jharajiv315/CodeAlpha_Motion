import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { api } from '../../lib/api.ts';
import type { User } from '../../types/index.ts';
import { getAvatarColor, getInitials } from '../../lib/utils.ts';
import {
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

export function AuthPage() {
  const { login, register, switchUserFast } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [demoUsers, setDemoUsers] = useState<User[]>([]);

  useEffect(() => {
    api.auth.getDemoUsers().then((res) => setDemoUsers(res.users)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please enter your full name');
        await register(name.trim(), email.trim(), password, workspaceName.trim() || undefined);
      } else {
        await login(email.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8F9FB] flex items-center justify-center p-4 md:p-8 text-[#20242B]">
      <div className="w-full max-w-5xl bg-white border border-[#E7E9ED] rounded-2xl shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">
        {/* Left Editorial Product Story (Desktop) */}
        <div className="hidden lg:flex lg:col-span-6 bg-[#F4F5F7] border-r border-[#E7E9ED] p-10 flex-col justify-between relative overflow-hidden">
          {/* Subtle architectural background grid */}
          <div
            className="absolute inset-0 opacity-[0.4] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#6D7480 0.75px, transparent 0.75px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Top Brand Mark */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#20242B] text-white font-bold text-xs flex items-center justify-center tracking-tight">
                M
              </span>
              <span className="font-semibold text-sm tracking-tight text-[#20242B]">MOTION</span>
            </div>
            <h2 className="text-2xl font-bold text-[#20242B] tracking-tight leading-tight pt-2">
              A calm workspace for teams who value clarity.
            </h2>
            <p className="text-xs text-[#6D7480] leading-relaxed max-w-sm">
              Know who owns the next action, what is preventing progress, and what was decided—without scheduling another status call.
            </p>
          </div>

          {/* Authentic miniature interface representation */}
          <div className="relative z-10 my-6 bg-white border border-[#E7E9ED] rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F3F5] text-xs">
              <span className="font-semibold text-[#20242B]">Core Platform V2</span>
              <span className="text-[11px] text-[#6D7480]">4 tasks · 1 blocker</span>
            </div>

            {/* Blocked task preview */}
            <div className="bg-[#FAF8F5] border border-[#EFE9DF] rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#20242B]">Payment Webhook Handlers</span>
                <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] px-1.5 py-0.5 rounded">
                  Blocked
                </span>
              </div>
              <p className="text-[11px] text-[#78350F] leading-snug">
                Waiting on Stripe sandbox webhook secret · Rajiv
              </p>
            </div>

            {/* Decision note preview */}
            <div className="bg-white border border-[#E7E9ED] rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#20242B]">
                <FileCheck className="w-3.5 h-3.5 text-[#5965D8]" />
                <span>Agreed: Self-serve portal for seat upgrades</span>
              </div>
              <p className="text-[11px] text-[#6D7480]">
                Avoids custom invoicing UI and PCI compliance overhead.
              </p>
            </div>
          </div>

          {/* Bottom subtle quote */}
          <div className="relative z-10 text-[11px] text-[#6D7480] flex items-center justify-between pt-2 border-t border-[#E7E9ED]">
            <span>Fast, persistent, real-time collaboration.</span>
            <span className="font-mono text-[10px]">v2.4</span>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between">
          <div>
            {/* Mobile Brand Mark */}
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <span className="w-7 h-7 rounded-lg bg-[#20242B] text-white font-bold text-xs flex items-center justify-center">
                M
              </span>
              <span className="font-semibold text-sm tracking-tight text-[#20242B]">MOTION</span>
            </div>

            {/* Heading */}
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-[#20242B]">
                {isRegister ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="text-xs text-[#6D7480]">
                {isRegister
                  ? 'Start organizing work with your team in minutes.'
                  : 'Sign in to continue your team’s work.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
              {isRegister && (
                <>
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-xs font-medium text-[#20242B] mb-1"
                    >
                      Full name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full text-xs bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg px-3 py-2 text-[#20242B] placeholder-[#9CA3AF] focus:bg-white focus:outline-hidden focus:border-[#5965D8] transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="auth-workspace"
                      className="block text-xs font-medium text-[#20242B] mb-1"
                    >
                      Workspace name <span className="text-[#9CA3AF] font-normal">(Optional)</span>
                    </label>
                    <input
                      id="auth-workspace"
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="e.g. Acme Studio"
                      className="w-full text-xs bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg px-3 py-2 text-[#20242B] placeholder-[#9CA3AF] focus:bg-white focus:outline-hidden focus:border-[#5965D8] transition-colors"
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-medium text-[#20242B] mb-1"
                >
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full text-xs bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg px-3 py-2 text-[#20242B] placeholder-[#9CA3AF] focus:bg-white focus:outline-hidden focus:border-[#5965D8] transition-colors"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-[#20242B] mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs bg-[#F8F9FB] border border-[#E7E9ED] rounded-lg pl-3 pr-8 py-2 text-[#20242B] placeholder-[#9CA3AF] focus:bg-white focus:outline-hidden focus:border-[#5965D8] transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6D7480] transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-2.5 text-xs bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2 text-xs font-semibold bg-[#20242B] hover:bg-[#323842] disabled:opacity-50 text-white rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{loading ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister((r) => !r);
                  setError(null);
                }}
                className="text-xs text-[#6D7480] hover:text-[#20242B] transition-colors"
              >
                {isRegister
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Create one"}
              </button>
            </div>
          </div>

          {/* Quick Teammate Access (Refined, calm, unobtrusive) */}
          {demoUsers.length > 0 && (
            <div className="pt-6 mt-6 border-t border-[#E7E9ED]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-[#6D7480]">
                  Quick test as teammate:
                </span>
                <span className="text-[10px] text-[#6D7480]">Click to sign in</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {demoUsers.slice(0, 4).map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => switchUserFast(u)}
                    className="p-1.5 px-2 bg-[#F8F9FB] hover:bg-[#F1F3F5] border border-[#E7E9ED] rounded-lg text-left transition-colors flex items-center gap-2 group cursor-pointer"
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${getAvatarColor(
                        u.name
                      )}`}
                    >
                      {getInitials(u.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[#20242B] truncate leading-tight">
                        {u.name}
                      </p>
                      <p className="text-[9px] text-[#6D7480] truncate leading-tight">{u.title}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
