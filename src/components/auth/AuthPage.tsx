import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { api } from '../../lib/api.ts';
import type { User } from '../../types/index.ts';
import { getAvatarColor, getInitials } from '../../lib/utils.ts';
import { PrismLogo } from '../ui/PrismLogo.tsx';
import {
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  FileCheck,
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-[#F7F4EC] text-[#33382F]">
      <div className="w-full max-w-5xl bg-[#FFFCF6] rounded-[12px] border border-[#DED8CB] shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px] animate-view-in">
        {/* Left Modest Product-Story Column (42% / 5 cols on desktop) */}
        <div className="hidden lg:flex lg:col-span-5 bg-[#F1EBDD] border-r border-[#DED8CB] p-9 flex-col justify-between">
          {/* Top Brand Mark & Headline */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <PrismLogo size="md" />
              <span className="font-bold text-[16px] tracking-[-0.02em] text-[#33382F]">
                MOTION
              </span>
            </div>
            <h2 className="text-[26px] font-bold text-[#33382F] tracking-[-0.025em] leading-[1.2]">
              Calm, tactile project coordination for focused teams.
            </h2>
            <p className="text-[13.5px] text-[#5D655A] leading-relaxed">
              See who owns the next step, surface blockers early, and keep architectural decisions attached to the work.
            </p>
          </div>

          {/* Simplified Board Preview Card */}
          <div className="my-6 bg-[#FFFCF6] rounded-[12px] p-4 border border-[#DED8CB] space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#EAE4D8] text-[12px]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#78906F]" />
                <span className="font-semibold text-[#33382F]">Core Platform V2</span>
              </div>
              <span className="text-[11px] text-[#5D655A] bg-[#F3EFE5] px-2 py-0.5 rounded-[6px] border border-[#DED8CB]">
                In Progress
              </span>
            </div>

            {/* Blocked task sample */}
            <div className="bg-[#FFFDF9] border border-[#DED8CB] rounded-[9px] p-3 space-y-2">
              <div className="flex items-center justify-between text-[11.5px] text-[#70786D]">
                <span>Due Oct 28</span>
                <span className="text-[11px] font-semibold text-[#7B4B3A] bg-[#F3E7DD] px-2 py-0.5 rounded-[6px]">
                  High
                </span>
              </div>
              <p className="text-[13px] font-semibold text-[#33382F]">
                Payment Webhook Handlers
              </p>
              <div className="text-[11.5px] bg-[#F3E7DD] text-[#7B4B3A] px-2.5 py-1.5 rounded-[6px] border border-[#DFC2B0]">
                Blocked · Waiting on Stripe sandbox webhook secret
              </div>
            </div>

            {/* Decision record sample */}
            <div className="bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px] p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#33382F]">
                <FileCheck className="w-3.5 h-3.5 text-[#596D56]" />
                <span>Decision: Self-serve seat upgrades</span>
              </div>
              <p className="text-[11.5px] text-[#5D655A] leading-snug">
                Avoids custom invoicing UI and keeps billing state synchronized.
              </p>
            </div>
          </div>

          {/* Bottom note */}
          <div className="text-[11.5px] text-[#70786D] flex items-center justify-between pt-2 border-t border-[#DED8CB]">
            <span>Real-time Kanban, blockers &amp; decisions</span>
            <span>MOTION</span>
          </div>
        </div>

        {/* Right Form Column (58% / 7 cols on desktop) */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-[#FFFCF6]">
          <div className="w-full max-w-[400px] mx-auto space-y-6">
            {/* Mobile Brand Mark */}
            <div className="lg:hidden flex items-center gap-2.5">
              <PrismLogo size="sm" />
              <span className="font-bold text-[15px] tracking-[-0.02em] text-[#33382F]">MOTION</span>
            </div>

            {/* Heading */}
            <div className="space-y-1">
              <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#33382F]">
                {isRegister ? 'Create your workspace account' : 'Sign in to MOTION'}
              </h1>
              <p className="text-[13.5px] text-[#5D655A]">
                {isRegister
                  ? 'Start organizing projects and tasks with your team.'
                  : 'Enter your credentials or choose a demo teammate below.'}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <>
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-[12.5px] font-semibold text-[#33382F] mb-1.5"
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
                      className="w-full text-[13.5px] motion-input rounded-[9px] px-3.5 py-2"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="auth-workspace"
                      className="block text-[12.5px] font-semibold text-[#33382F] mb-1.5"
                    >
                      Workspace name <span className="text-[#70786D] font-normal">(Optional)</span>
                    </label>
                    <input
                      id="auth-workspace"
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="e.g. Acme Studio"
                      className="w-full text-[13.5px] motion-input rounded-[9px] px-3.5 py-2"
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-[12.5px] font-semibold text-[#33382F] mb-1.5"
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
                  className="w-full text-[13.5px] motion-input rounded-[9px] px-3.5 py-2"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-[12.5px] font-semibold text-[#33382F] mb-1.5"
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
                    className="w-full text-[13.5px] motion-input rounded-[9px] pl-3.5 pr-10 py-2"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#70786D] hover:text-[#33382F] transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 text-[12.5px] bg-[#F3E7DD] text-[#985C51] border border-[#DFC2B0] rounded-[9px] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#985C51]" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-[13px] font-semibold btn-primary rounded-[9px] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister((r) => !r);
                  setError(null);
                }}
                className="text-[12.5px] text-[#5D655A] hover:text-[#33382F] font-medium transition-colors cursor-pointer"
              >
                {isRegister
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Create one"}
              </button>
            </div>

            {/* Quick Demo Account Switcher */}
            {demoUsers.length > 0 && (
              <div className="pt-5 border-t border-[#EAE4D8] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-[#70786D]">
                    Quick demo account switch
                  </span>
                  <span className="text-[11px] text-[#596D56] font-medium">1-click sign in</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {demoUsers.slice(0, 4).map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => switchUserFast(u)}
                      className="p-2 bg-[#F3EFE5] hover:bg-[#EDE7DA] border border-[#DED8CB] rounded-[9px] text-left transition-colors flex items-center gap-2 group cursor-pointer"
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${getAvatarColor(
                          u.name
                        )}`}
                      >
                        {getInitials(u.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-[#33382F] truncate leading-tight">
                          {u.name}
                        </p>
                        <p className="text-[10.5px] text-[#70786D] truncate leading-tight">{u.title}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
