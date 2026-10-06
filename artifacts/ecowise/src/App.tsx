import { type ButtonHTMLAttributes, type FormEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createClient, type Session } from '@supabase/supabase-js';
import {
  Activity, ArrowRight, Award, BarChart3, Bike, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Flame,
  Footprints, Leaf, LockKeyhole, LogOut, Menu, Search, Settings, ShieldCheck, Sparkles,
  Sprout, Target, Trophy, UserRound, X, Zap,
} from 'lucide-react';
import {
  ActivityCategory, getGetActivitiesQueryKey, getGetActivityQueryKey, getGetBadgesQueryKey,
  getGetChallengesQueryKey, getGetDashboardQueryKey, useAnalyzeActivity,
  useCompleteRecommendation, useGetActivities, useGetActivity, useGetBadges,
  useGetChallenges, useGetDashboard, useHealthCheck, useJoinChallenge, useUpdateProfile, setAuthTokenGetter,
  type ActivityRecord, type BadgeProgress, type ChallengeProgress, type Profile,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://missing-supabase-url.invalid',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-public-anon-key',
);
setAuthTokenGetter(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);

type AuthState = { session: Session | null; loading: boolean };
const AuthContext = createContext<AuthState>({ session: null, loading: true });
const categories = Object.values(ActivityCategory);
const categoryIcon: Record<string, typeof Bike> = {
  Transportation: Bike, Energy: Zap, Water: Sprout, Food: Leaf,
  Shopping: Target, Waste: Sprout, Lifestyle: Footprints, Other: Activity,
};

function useAuth() { return useContext(AuthContext); }
function useNotice() {
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return { notice, notify: (text: string, type: 'success' | 'error' = 'success') => setNotice({ text, type }) };
}

function Logo({ light = false }: { light?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 ${light ? 'text-white' : 'text-emerald-950'}`}>
    <span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? 'bg-white/15' : 'bg-emerald-800'}`}><Leaf size={19} className="text-white" strokeWidth={2.2} /></span>
    <span className="font-display text-[20px] font-extrabold tracking-[-.06em]">ecowise</span>
  </span>;
}
function Btn({ children, className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'outline' | 'quiet' }) {
  const styles = {
    primary: 'bg-emerald-800 text-white shadow-[0_5px_14px_rgba(26,95,67,.16)] hover:bg-emerald-900',
    soft: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200',
    outline: 'border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50',
    quiet: 'text-emerald-800 hover:bg-emerald-50',
  };
  return <button {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-px disabled:pointer-events-none disabled:opacity-55 ${styles[variant]} ${className}`}>{children}</button>;
}
function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button aria-label={label} title={label} {...props} className={`grid h-10 w-10 place-items-center rounded-xl text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50 ${props.className ?? ''}`}>{children}</button>;
}
function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-emerald-950">{label}<input {...props} className={`h-12 w-full rounded-xl border border-emerald-100 bg-[#fbfdfb] px-4 text-[15px] font-normal text-emerald-950 outline-none transition placeholder:text-emerald-900/35 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${props.className ?? ''}`} />{hint && <span className="text-xs font-normal text-emerald-800/55">{hint}</span>}</label>;
}
function TextArea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-emerald-950">{label}<textarea {...props} className={`w-full rounded-xl border border-emerald-100 bg-[#fbfdfb] px-4 py-3 text-[15px] font-normal leading-6 text-emerald-950 outline-none transition placeholder:text-emerald-900/35 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${props.className ?? ''}`} /></label>;
}
function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold text-emerald-950">{label}<span className="relative"><select {...props} className={`h-12 w-full appearance-none rounded-xl border border-emerald-100 bg-[#fbfdfb] px-4 pr-10 text-sm font-normal text-emerald-950 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${props.className ?? ''}`}>{children}</select><ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-emerald-800/50" /></span></label>;
}
function Skeleton({ className = '' }: { className?: string }) { return <div className={`animate-pulse rounded-xl bg-emerald-100/70 ${className}`} />; }
function LoadingPanel({ label = 'Loading your data…' }: { label?: string }) {
  return <div className="grid gap-4" role="status" aria-label={label}><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div><Skeleton className="h-64" /><span className="sr-only">{label}</span></div>;
}
function ErrorPanel({ onRetry, message = 'We couldn’t load this just now.' }: { onRetry: () => void; message?: string }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950" role="alert"><div className="flex items-start gap-3"><CircleHelp size={20} className="mt-0.5 shrink-0 text-rose-700" /><div><h3 className="font-bold">A small pause</h3><p className="mt-1 text-sm text-rose-900/70">{message}</p><Btn variant="outline" className="mt-4 border-rose-200 text-rose-900" onClick={onRetry}>Try again</Btn></div></div></div>;
}
function EmptyState({ icon: Icon = Sprout, title, detail, action }: { icon?: typeof Leaf; title: string; detail: string; action?: ReactNode }) {
  return <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-emerald-200 bg-[#fbfdfb] px-6 py-10 text-center"><div className="max-w-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><Icon size={22} /></span><h3 className="mt-4 font-display text-lg font-bold text-emerald-950">{title}</h3><p className="mt-1 text-sm leading-6 text-emerald-900/60">{detail}</p>{action && <div className="mt-4">{action}</div>}</div></div>;
}
function PageTitle({ eyebrow, title, detail, right }: { eyebrow?: string; title: string; detail?: string; right?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-emerald-700">{eyebrow}</p>}<h1 className="font-display text-3xl font-extrabold tracking-[-.055em] text-emerald-950 sm:text-[36px]">{title}</h1>{detail && <p className="mt-2 max-w-2xl text-[15px] leading-6 text-emerald-900/60">{detail}</p>}</div>{right}</div>;
}
function Panel({ title, subtitle, children, action, className = '' }: { title?: string; subtitle?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`rounded-[22px] border border-emerald-100/80 bg-white p-5 shadow-[0_6px_22px_rgba(30,74,58,.045)] sm:p-6 ${className}`}><div className="mb-5 flex items-start justify-between gap-4">{(title || subtitle) && <div>{title && <h2 className="font-display text-lg font-extrabold tracking-[-.035em] text-emerald-950">{title}</h2>}{subtitle && <p className="mt-1 text-sm text-emerald-900/55">{subtitle}</p>}</div>}{action}</div>{children}</section>;
}
function Notice({ notice, close }: { notice: { text: string; type: 'success' | 'error' } | null; close: () => void }) {
  if (!notice?.text) return null;
  return <div className={`fixed bottom-5 right-5 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl ${notice.type === 'success' ? 'border-emerald-200 bg-white text-emerald-950' : 'border-rose-200 bg-rose-50 text-rose-950'}`} role="status"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${notice.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{notice.type === 'success' ? <Check size={16} /> : <X size={16} />}</span><span className="text-sm font-medium">{notice.text}</span><IconButton label="Dismiss message" onClick={close}><X size={16} /></IconButton></div>;
}
function Avatar({ profile, size = 'md' }: { profile?: Partial<Profile> | null; size?: 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'h-20 w-20 text-xl' : 'h-10 w-10 text-sm';
  const initials = profile?.fullName?.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'E';
  return profile?.avatarUrl ? <img src={profile.avatarUrl} alt={`${profile.fullName || 'Your'} profile`} className={`${dimensions} rounded-full object-cover ring-2 ring-white`} /> : <span className={`${dimensions} grid place-items-center rounded-full bg-[#d9eee3] font-bold text-emerald-900 ring-2 ring-white`}>{initials}</span>;
}
function formattedDate(value?: string | null) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date); }
function cap(value?: string | null) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : ''; }
function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const percent = Math.max(0, Math.min(100, max > 0 ? value / max * 100 : 0));
  return <div className="h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-teal-500 transition-all duration-500" style={{ width: `${percent}%` }} /></div>;
}
function CategoryTag({ category }: { category: string }) {
  const Icon = categoryIcon[category] ?? Activity;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"><Icon size={13} />{category}</span>;
}
function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="grid min-h-[100dvh] place-items-center bg-[#f2f8f3]"><div className="w-64 space-y-3"><Skeleton className="h-10 w-10 rounded-2xl" /><Skeleton className="h-6 w-44" /><Skeleton className="h-4 w-60" /></div></div>;
  if (!session) return <RedirectToLogin />;
  return <>{children}</>;
}
function RedirectToLogin() {
  const [path, setPath] = useLocation();
  useEffect(() => { setPath(`/login?next=${encodeURIComponent(path)}`); }, [path, setPath]);
  return null;
}

const appNavigation = [
  { href: '/dashboard', label: 'Overview', icon: BarChart3 },
  { href: '/analyse', label: 'Analyse', icon: Sparkles },
  { href: '/history', label: 'History', icon: Clock3 },
  { href: '/challenges', label: 'Challenges', icon: Target },
  { href: '/badges', label: 'Badges', icon: Award },
];
function AppShell({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [path, setPath] = useLocation();
  const queryClient = useQueryClient();
  const profile = queryClient.getQueryData<{ profile: Profile }>(getGetDashboardQueryKey())?.profile;
  const closeMenu = () => setMobileOpen(false);
  async function logout() { await supabase.auth.signOut(); queryClient.clear(); setPath('/'); }
  return <div className="min-h-[100dvh] bg-[#f3f8f3]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-emerald-100 bg-[#f7faf6] px-5 py-6 lg:flex">
      <Link href="/dashboard" className="mb-10 px-2"><Logo /></Link>
      <div className="mb-3 px-3 text-[10px] font-extrabold uppercase tracking-[.18em] text-emerald-900/35">Your space</div>
      <nav className="grid gap-1.5">
        {appNavigation.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href === '/history' && location.startsWith('/history/'));
          return <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-[14px] font-semibold transition ${active ? 'bg-emerald-800 text-white shadow-[0_5px_14px_rgba(26,95,67,.15)]' : 'text-emerald-950/65 hover:bg-emerald-100/80 hover:text-emerald-950'}`}><Icon size={18} strokeWidth={2.1} />{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#c7ed9f]" />}</Link>;
        })}
      </nav>
      <div className="mt-auto">
        <div className="mb-4 overflow-hidden rounded-2xl bg-[#e1efe3] p-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/80 text-emerald-800"><Sprout size={19} /></span>
          <p className="mt-3 font-display text-sm font-bold text-emerald-950">Small steps add up.</p>
          <p className="mt-1 text-xs leading-5 text-emerald-900/60">Notice a routine you’d like to rethink? Start with one.</p>
          <Link href="/analyse" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-800">Explore an idea <ArrowRight size={13} /></Link>
        </div>
        <Link href="/settings" className={`mb-1 flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold ${location === '/settings' ? 'bg-emerald-100 text-emerald-900' : 'text-emerald-900/65 hover:bg-emerald-100'}`}><Settings size={18} />Settings</Link>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold text-emerald-900/65 hover:bg-emerald-100" data-testid="button-logout"><LogOut size={18} />Log out</button>
      </div>
    </aside>
    <div className="lg:pl-[248px]">
      <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-emerald-100/80 bg-[#f7faf6]/90 px-4 backdrop-blur-md sm:px-7 lg:px-10">
        <div className="flex items-center gap-3">
          <IconButton label="Open navigation" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></IconButton>
          <div className="lg:hidden"><Link href="/dashboard"><Logo /></Link></div>
          <span className="hidden text-[13px] font-medium text-emerald-900/50 sm:inline">A little better, one day at a time.</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/profile" className="flex items-center gap-2.5 rounded-full p-1 pr-2.5 transition hover:bg-emerald-100/70" data-testid="link-profile"><Avatar profile={profile} /><span className="hidden max-w-36 truncate text-sm font-semibold text-emerald-950 sm:inline">{profile?.fullName || session?.user.email?.split('@')[0] || 'Your profile'}</span><ChevronDown size={14} className="hidden text-emerald-800/50 sm:block" /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">{children}</main>
    </div>
    {mobileOpen && <div className="fixed inset-0 z-[80] bg-emerald-950/30 lg:hidden" onClick={closeMenu}><div className="flex h-full w-[min(84vw,320px)] flex-col bg-[#f7faf6] p-5 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-9 flex items-center justify-between"><Link href="/dashboard" onClick={closeMenu}><Logo /></Link><IconButton label="Close navigation" onClick={closeMenu}><X size={20} /></IconButton></div><nav className="grid gap-2">{appNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={closeMenu} className={`flex items-center gap-3 rounded-xl px-3 py-3 font-semibold ${location === href ? 'bg-emerald-800 text-white' : 'text-emerald-950/70 hover:bg-emerald-100'}`}><Icon size={19} />{label}</Link>)}</nav><div className="mt-auto grid gap-2"><Link href="/settings" onClick={closeMenu} className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-emerald-950/70 hover:bg-emerald-100"><Settings size={19} />Settings</Link><button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold text-emerald-950/70 hover:bg-emerald-100"><LogOut size={19} />Log out</button></div></div></div>}
  </div>;
}
function Protected({ children }: { children: ReactNode }) { return <AuthGate><AppShell>{children}</AppShell></AuthGate>; }

function Landing() {
  const health = useHealthCheck();
  return <div className="min-h-[100dvh] overflow-hidden bg-[#f7faf6] text-emerald-950">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-9">
      <Link href="/"><Logo /></Link>
      <nav className="hidden items-center gap-8 text-sm font-semibold text-emerald-950/65 md:flex">
        <a href="#how-it-works" className="transition hover:text-emerald-800">How it works</a><a href="#your-progress" className="transition hover:text-emerald-800">Your progress</a>
      </nav>
      <div className="flex items-center gap-2 sm:gap-3"><Link href="/login" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 sm:block">Log in</Link><Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900">Get started <ArrowRight size={15} /></Link></div>
    </header>
    <main>
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-9 sm:px-9 sm:pb-28 sm:pt-14 lg:grid-cols-[1.02fr_.98fr]">
        <div className="relative z-10 max-w-[650px] rise-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/75 px-3.5 py-2 text-xs font-bold text-emerald-800"><span className="h-2 w-2 rounded-full bg-teal-500" />Make room for a greener routine</div>
          <h1 className="font-display text-[clamp(3.1rem,7vw,5.85rem)] font-extrabold leading-[.99] tracking-[-.075em] text-emerald-950">Good habits.<br /><span className="text-emerald-700">Lighter living.</span></h1>
          <p className="mt-7 max-w-[500px] text-[17px] leading-7 text-emerald-950/65 sm:text-lg">A practical companion for the choices you make every day. Find thoughtful alternatives, try what fits, and see your progress take shape.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-800 px-5 font-bold text-white shadow-[0_8px_18px_rgba(26,95,67,.18)] transition hover:-translate-y-0.5 hover:bg-emerald-900">Start with one small step <ArrowRight size={17} /></Link><a href="#how-it-works" className="inline-flex h-12 items-center gap-2 rounded-xl px-4 font-semibold text-emerald-900/70 hover:bg-emerald-100/70">See how it works <ChevronRight size={16} /></a></div>
          <div className="mt-10 flex items-center gap-3 text-sm text-emerald-950/55"><span className="flex -space-x-2"><i className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7faf6] bg-[#d1e8da] text-emerald-800"><Leaf size={13} /></i><i className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7faf6] bg-[#deead1] text-emerald-800"><Sprout size={13} /></i><i className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#f7faf6] bg-[#cce9e3] text-emerald-800"><Footprints size={13} /></i></span><span>Progress that feels personal, not perfect.</span></div>
        </div>
        <div className="relative mx-auto w-full max-w-[590px] lg:ml-auto">
          <div className="absolute -right-6 -top-5 h-52 w-52 rounded-full bg-[#dcefe0] blur-2xl" /><div className="absolute -bottom-6 -left-8 h-56 w-56 rounded-full bg-[#d5ece5] blur-2xl" />
          <div className="relative min-h-[390px] overflow-hidden rounded-[34px] border border-emerald-100 bg-[#e9f2e7] p-5 shadow-[0_26px_70px_rgba(38,83,62,.13)] sm:min-h-[480px] sm:p-8">
            <div className="absolute inset-0 eco-grid opacity-40" /><div className="absolute -right-20 -top-24 h-[320px] w-[320px] rounded-full border border-emerald-800/10" /><div className="absolute -right-8 -top-12 h-[250px] w-[250px] rounded-full border border-emerald-800/10" />
            <div className="relative flex items-center justify-between"><span className="rounded-full bg-white/75 px-3 py-1.5 text-xs font-bold text-emerald-800">Your week, in view</span><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-emerald-800 shadow-sm"><Sprout size={18} /></span></div>
            <div className="relative mt-9 max-w-[340px]"><p className="text-sm font-semibold text-emerald-900/55">A more mindful routine begins here</p><h2 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-[-.055em] text-emerald-950 sm:text-[40px]">Progress, at your own pace.</h2><p className="mt-3 max-w-[310px] text-sm leading-6 text-emerald-950/60">Make an observation. Get ideas that meet you where you are.</p></div>
            <div className="absolute bottom-6 left-5 right-5 grid grid-cols-[1fr_132px] items-end gap-3 sm:bottom-8 sm:left-8 sm:right-8 sm:grid-cols-[1fr_160px]">
              <div className="relative rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_10px_25px_rgba(29,75,56,.09)] backdrop-blur">
                <div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-emerald-900/50">Activity rhythm</p><p className="mt-1 font-display text-lg font-extrabold text-emerald-950">Made for real life</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><BarChart3 size={18} /></span></div>
                <div className="mt-5 flex h-[86px] items-end gap-2 sm:gap-3">{[28, 42, 36, 68, 50, 80, 59].map((height, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><span className="w-full rounded-t-md bg-gradient-to-t from-emerald-700 to-teal-400" style={{ height: `${height}px`, opacity: .55 + index * .06 }} /><i className="h-1 w-1 rounded-full bg-emerald-900/25" /></div>)}</div>
              </div>
              <div className="relative rounded-2xl bg-emerald-800 p-4 text-white shadow-[0_12px_28px_rgba(26,95,67,.2)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Sparkles size={17} /></span><p className="mt-5 font-display text-base font-extrabold">One change at a time.</p><p className="mt-1 text-xs leading-5 text-white/70">Explore alternatives that make sense for you.</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#d4efb2]">Make it yours <ArrowRight size={13} /></span></div>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="border-y border-emerald-100 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-9"><div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">A kinder kind of tracking</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-.06em] sm:text-5xl">Less guessing. More doing.</h2><p className="mt-4 text-base leading-7 text-emerald-950/60">EcoWise turns everyday routines into manageable opportunities to try something new.</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { n: '01', icon: Search, title: 'Notice a routine', body: 'Describe something you do today—your commute, a meal, or a household habit.' },
              { n: '02', icon: Sparkles, title: 'Explore your options', body: 'Get relevant suggestions you can weigh against your time, comfort, and budget.' },
              { n: '03', icon: Sprout, title: 'Build a little momentum', body: 'Mark the changes you try and follow your own progress across days and weeks.' },
            ].map(({ n, icon: Icon, title, body }) => <article key={n} className="group rounded-[22px] border border-emerald-100 bg-[#f7faf6] p-6 transition hover:-translate-y-1 hover:shadow-lg sm:p-7"><div className="flex items-center justify-between"><span className="font-mono text-xs font-bold tracking-widest text-emerald-700/55">{n}</span><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#deeee3] text-emerald-800 transition group-hover:bg-emerald-800 group-hover:text-white"><Icon size={20} /></span></div><h3 className="mt-8 font-display text-xl font-extrabold tracking-[-.04em]">{title}</h3><p className="mt-2 text-sm leading-6 text-emerald-950/60">{body}</p></article>)}
          </div>
        </div>
      </section>
      <section id="your-progress" className="relative overflow-hidden py-20 sm:py-28"><div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-[#e1f0e5] blur-3xl" /><div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-9 lg:grid-cols-[.9fr_1.1fr]">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Keep what works</p><h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-[-.06em] sm:text-5xl">Your progress is yours to define.</h2><p className="mt-5 max-w-lg leading-7 text-emerald-950/60">Track activities, join gentle challenges, and collect badges as you go. No leaderboard pressure—just a clearer picture of the choices you’re making.</p><Link href="/signup" className="mt-7 inline-flex items-center gap-2 font-bold text-emerald-800">Build your own rhythm <ArrowRight size={16} /></Link></div>
        <div className="rounded-[26px] border border-emerald-100 bg-white p-5 shadow-[0_18px_50px_rgba(38,83,62,.09)] sm:p-7"><div className="flex items-center justify-between border-b border-emerald-100 pb-4"><div><p className="text-xs font-semibold text-emerald-900/50">Your dashboard</p><h3 className="mt-1 font-display text-xl font-extrabold">A view of what matters</h3></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><BarChart3 size={19} /></span></div><div className="grid grid-cols-2 gap-3 py-5"><div className="rounded-2xl bg-[#f4f8f3] p-4"><span className="text-xs font-semibold text-emerald-900/50">Activity history</span><div className="mt-2 flex h-14 items-end gap-2">{[34, 48, 38, 62, 55, 75, 64].map((h, i) => <span key={i} className="flex-1 rounded-t bg-emerald-600/75" style={{ height: h }} />)}</div></div><div className="rounded-2xl bg-[#f4f8f3] p-4"><span className="text-xs font-semibold text-emerald-900/50">Habit practice</span><div className="mt-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#deeee3] text-emerald-800"><Flame size={19} /></span><span className="text-sm font-bold text-emerald-950">One step at a time</span></div><p className="mt-2 text-xs text-emerald-900/50">No perfect streak required.</p></div></div><div className="rounded-2xl bg-emerald-800 p-4 text-white"><div className="flex items-center justify-between"><span className="text-sm font-semibold">A challenge that fits</span><span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-[#d5efb7]">Your pace</span></div><p className="mt-2 text-xs leading-5 text-white/70">Try a fresh routine when you’re ready. Your progress will be here when you return.</p></div></div>
      </div></section>
      <section className="px-5 pb-20 sm:px-9 sm:pb-24"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[28px] bg-[#e5efe3] p-7 sm:flex-row sm:items-center sm:p-10"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">Curiosity is a good start</p><h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-.055em] sm:text-3xl">What could you change today?</h2><p className="mt-2 text-sm text-emerald-950/60">Create an account and find a first step that feels doable.</p></div><Link href="/signup" className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-emerald-800 px-5 font-bold text-white hover:bg-emerald-900">Try EcoWise <ArrowRight size={16} /></Link></div></section>
    </main>
    <footer className="border-t border-emerald-100 bg-[#f1f6f0]"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-5 py-7 sm:flex-row sm:items-center sm:px-9"><Logo /><p className="text-xs text-emerald-950/45">A thoughtful companion for everyday choices.</p><div className="flex items-center gap-4 text-xs font-semibold text-emerald-900/60"><Link href="/login" className="hover:text-emerald-800">Log in</Link><Link href="/signup" className="hover:text-emerald-800">Get started</Link><span className="text-emerald-900/35" title={health.isLoading ? 'Checking service status' : health.isError ? 'Service status unavailable' : `Service ${health.data?.status ?? 'available'}`}><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${health.isError ? 'bg-rose-500' : health.isLoading ? 'bg-amber-400' : 'bg-teal-500'}`} />{health.isError ? 'Service status unavailable' : health.isLoading ? 'Checking service' : `Service ${health.data?.status ?? 'available'}`}</span></div></div></footer>
  </div>;
}

function AuthPage({ mode }: { mode: 'login' | 'signup' | 'forgot' }) {
  const { session } = useAuth();
  const [location, setLocation] = useLocation();
  const setupProfile = useUpdateProfile();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { if (session && mode !== 'forgot') setLocation('/dashboard'); }, [session, mode, setLocation]);
  const recoveryMode = mode === 'forgot' && (location.includes('mode=update') || window.location.hash.includes('type=recovery'));
  const params = new URLSearchParams(location.split('?')[1] || '');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try {
      if (mode === 'forgot' && !recoveryMode && !email.trim()) throw new Error('Enter your email address.');
      if (mode === 'forgot') {
        if (recoveryMode) {
          if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
          if (password !== confirmPassword) throw new Error('Those passwords don’t match.');
          const { error: authError } = await supabase.auth.updateUser({ password });
          if (authError) throw authError;
          setSuccess('Your password has been updated. You’re ready to continue.');
          setTimeout(() => setLocation('/dashboard'), 900);
        } else {
          const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/forgot-password?mode=update` });
          if (authError) throw authError;
          setSuccess('If an account exists for this email, a password recovery link is on its way.');
        }
      } else if (mode === 'signup') {
        if (fullName.trim().length < 1) throw new Error('Add your name to continue.');
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } });
        if (authError) throw authError;
        if (data.session && category) {
          await setupProfile.mutateAsync({ data: { preferredCategory: category as typeof ActivityCategory[keyof typeof ActivityCategory] } });
        }
        if (data.session) setLocation('/dashboard');
        else setSuccess('Check your inbox to confirm your email, then come back to log in.');
      } else {
        if (!password) throw new Error('Enter your password.');
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        setLocation(params.get('next') || '/dashboard');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  const title = mode === 'login' ? 'Welcome back.' : mode === 'signup' ? 'A good place to begin.' : recoveryMode ? 'Choose a new password.' : 'Let’s get you back in.';
  const subtitle = mode === 'login' ? 'Pick up where your greener routine left off.' : mode === 'signup' ? 'Set up your space. You can change direction any time.' : recoveryMode ? 'Choose a strong password for your EcoWise account.' : 'We’ll send a secure reset link to your email.';
  return <div className="grid min-h-[100dvh] bg-[#f4f8f3] lg:grid-cols-[.94fr_1.06fr]">
    <aside className="relative hidden overflow-hidden bg-emerald-900 p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div className="absolute -right-32 -top-20 h-[460px] w-[460px] rounded-full border border-white/10" /><div className="absolute -right-14 top-8 h-[330px] w-[330px] rounded-full border border-white/10" /><div className="absolute bottom-20 left-10 h-60 w-60 rounded-full bg-teal-300/10 blur-3xl" />
      <Link href="/" className="relative"><Logo light /></Link>
      <div className="relative max-w-xl"><span className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Leaf size={23} /></span><p className="font-display text-4xl font-extrabold leading-tight tracking-[-.06em] xl:text-5xl">A better routine can start with one honest observation.</p><p className="mt-5 max-w-md leading-7 text-white/65">Explore practical ideas, choose what fits, and make progress your own.</p><div className="mt-9 flex items-center gap-3 text-sm font-medium text-white/70"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><ShieldCheck size={17} /></span>Your account and progress, in one thoughtful place.</div></div>
      <p className="relative text-xs text-white/40">EcoWise · Everyday choices, made visible.</p>
    </aside>
    <main className="flex items-center justify-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-[440px]">
        <div className="mb-10 flex items-center justify-between lg:hidden"><Link href="/"><Logo /></Link><Link href={mode === 'login' ? '/signup' : '/login'} className="text-sm font-semibold text-emerald-800">{mode === 'login' ? 'Create account' : 'Log in'}</Link></div>
        <div className="mb-8"><div className="mb-5 hidden lg:block"><Link href="/"><Logo /></Link></div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">{mode === 'forgot' ? 'Account recovery' : mode === 'signup' ? 'Your EcoWise space' : 'Good to see you'}</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.06em] text-emerald-950 sm:text-[40px]">{title}</h1><p className="mt-2 text-sm leading-6 text-emerald-950/55">{subtitle}</p></div>
        <form onSubmit={submit} className="grid gap-5">
          {mode === 'signup' && <Field label="Your name" name="name" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="How should we call you?" required data-testid="input-name" />}
          {(mode !== 'forgot' || recoveryMode) && <Field label={recoveryMode ? 'New password' : 'Password'} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' || recoveryMode ? 'At least 8 characters' : 'Your password'} required minLength={mode === 'signup' || recoveryMode ? 8 : undefined} data-testid="input-password" />}
          {recoveryMode && <Field label="Confirm new password" name="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter it once more" required minLength={8} data-testid="input-confirm-password" />}
          {mode === 'forgot' && !recoveryMode && <Field label="Email address" name="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required data-testid="input-email" />}
          {mode === 'signup' && <Select label="What would you like to explore first?" value={category} onChange={e => setCategory(e.target.value)} data-testid="select-category"><option value="">I’ll decide later</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</Select>}
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">{success}</p>}
          <Btn type="submit" disabled={busy} className="mt-1 h-12 w-full" data-testid="button-submit-auth">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : recoveryMode ? 'Update password' : 'Send recovery link'}{!busy && <ArrowRight size={16} />}</Btn>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">{mode === 'login' && <Link href="/forgot-password" className="font-semibold text-emerald-700 hover:text-emerald-900">Forgot password?</Link>}{mode === 'forgot' ? <Link href="/login" className="flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900"><ChevronLeft size={14} />Back to log in</Link> : <p className="text-emerald-950/55">{mode === 'login' ? 'New to EcoWise?' : 'Already have an account?'} <Link href={mode === 'login' ? '/signup' : '/login'} className="font-bold text-emerald-800">{mode === 'login' ? 'Sign up' : 'Log in'}</Link></p>}</div>
        {mode === 'signup' && <p className="mt-7 text-xs leading-5 text-emerald-950/40">By creating an account, you agree to use EcoWise as a personal guide—not a substitute for your own judgement.</p>}
      </div>
    </main>
  </div>;
}

function DashboardPage() {
  const query = useGetDashboard();
  const dashboard = query.data;
  if (query.isLoading) return <LoadingPanel />;
  if (query.isError || !dashboard) return <ErrorPanel onRetry={() => query.refetch()} message="Your overview isn’t available right now. Your saved data hasn’t been changed." />;
  const { profile, weeklyActivity, categoryBreakdown, recentActivities, earnedBadges, activeChallenges, pointsHistory } = dashboard;
  const weeklyMax = Math.max(1, ...weeklyActivity.map(item => item.activityCount));
  const pointsMax = Math.max(1, ...pointsHistory.map(item => item.points));
  const categoryTotal = categoryBreakdown.reduce((sum, item) => sum + item.count, 0);
  return <div className="page-enter">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-700">Your EcoWise overview</p><h1 className="font-display text-3xl font-extrabold tracking-[-.06em] text-emerald-950 sm:text-[38px]">Hello, {profile.fullName.split(' ')[0] || 'there'}.</h1><p className="mt-2 text-sm text-emerald-900/60">Here’s the progress you’ve made in your own rhythm.</p></div><Link href="/analyse" className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-800 px-4 font-bold text-white shadow-sm hover:bg-emerald-900"><Sparkles size={16} />Explore an activity</Link></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Eco score', value: profile.ecoScore, unit: '/ 100', icon: Leaf, color: 'bg-emerald-100 text-emerald-800', note: 'A snapshot of your activity' },
        { label: 'Points collected', value: profile.totalPoints, unit: '', icon: Zap, color: 'bg-[#e2f2e9] text-teal-800', note: 'Earned by completing ideas' },
        { label: 'Current streak', value: profile.currentStreak, unit: profile.currentStreak === 1 ? 'day' : 'days', icon: Flame, color: 'bg-[#f8edda] text-amber-800', note: `Longest: ${profile.longestStreak} ${profile.longestStreak === 1 ? 'day' : 'days'}` },
        { label: 'Activities explored', value: profile.totalActivities, unit: '', icon: Activity, color: 'bg-[#e9e7f2] text-violet-800', note: 'Every entry helps you reflect' },
      ].map(({ label, value, unit, icon: Icon, color, note }) => <Panel key={label} className="p-5"><div className="flex items-start justify-between"><span className="text-sm font-semibold text-emerald-900/55">{label}</span><span className={`grid h-10 w-10 place-items-center rounded-xl ${color}`}><Icon size={19} /></span></div><div className="mt-4 flex items-baseline gap-1.5"><span className="font-display text-[34px] font-extrabold tracking-[-.06em] text-emerald-950">{value}</span><span className="text-sm font-semibold text-emerald-900/45">{unit}</span></div><p className="mt-1 text-xs text-emerald-900/50">{note}</p></Panel>)}
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
      <Panel title="Your week" subtitle="Activities recorded by day" action={<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Recent activity</span>}>
        {weeklyActivity.length ? <div className="grid min-h-[210px] grid-cols-7 items-end gap-2 sm:gap-5">{weeklyActivity.map((day, index) => { const date = new Date(day.date); return <div className="flex h-full flex-col items-center justify-end gap-2" key={day.date}><span className="text-[10px] font-semibold text-emerald-900/50 sm:text-xs">{day.activityCount}</span><div className="flex h-[142px] w-full items-end rounded-t-lg bg-emerald-50"><div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-800 to-teal-500 transition-all duration-500" style={{ height: `${Math.max(day.activityCount ? 10 : 0, day.activityCount / weeklyMax * 100)}%` }} title={`${day.activityCount} activities`} /></div><span className="text-[10px] font-semibold text-emerald-900/45 sm:text-xs">{Number.isNaN(date.getTime()) ? `Day ${index + 1}` : new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)}</span></div>; })}</div> : <EmptyState title="Your week is open" detail="As you log activities, your week will take shape here." action={<Link href="/analyse" className="text-sm font-bold text-emerald-800">Explore your first activity <ArrowRight className="ml-1 inline" size={14} /></Link>} />}
      </Panel>
      <Panel title="Activity mix" subtitle="Categories you’ve explored">
        {categoryTotal ? <div className="grid gap-4">{categoryBreakdown.filter(item => item.count > 0).map(item => <div key={item.category}><div className="mb-2 flex items-center justify-between"><CategoryTag category={item.category} /><span className="text-xs font-bold text-emerald-900/50">{item.count}</span></div><ProgressBar value={item.count} max={Math.max(...categoryBreakdown.map(part => part.count))} /></div>)}</div> : <EmptyState title="No categories yet" detail="Explore an activity to see where your routines lead." />}</Panel>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
      <Panel title="Recently explored" subtitle="Your latest activity notes" action={<Link href="/history" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800">See history <ArrowRight size={13} /></Link>}>
        {recentActivities.length ? <div className="divide-y divide-emerald-100">{recentActivities.slice(0, 5).map(item => <ActivityRow key={item.id} item={item} />)}</div> : <EmptyState title="Your story starts here" detail="Save your first activity and your recent notes will appear in this space." action={<Link href="/analyse" className="text-sm font-bold text-emerald-800">Analyse an activity <ArrowRight size={14} className="ml-1 inline" /></Link>} />}
      </Panel>
      <div className="grid content-start gap-5">
        <Panel title="Points over time" subtitle="Points from your saved activity"><div className="flex h-24 items-end gap-1.5">{pointsHistory.length ? pointsHistory.map(day => <div key={day.date} className="group relative flex flex-1 flex-col items-center justify-end"><div className="w-full rounded-t-md bg-teal-500/80 transition hover:bg-emerald-700" style={{ height: `${Math.max(day.points ? 7 : 2, day.points / pointsMax * 76)}px` }} title={`${day.points} points · ${formattedDate(day.date)}`} /><span className="mt-1 w-full truncate text-center text-[9px] text-emerald-900/40">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>) : <p className="m-auto text-center text-sm text-emerald-900/50">Points will appear after you record an activity.</p>}</div></Panel>
        <Panel title="Your milestones" subtitle={earnedBadges.length ? `${earnedBadges.length} earned` : 'Collect badges as you progress'} action={<Link href="/badges" className="text-xs font-bold text-emerald-800">All badges</Link>}>
          {earnedBadges.length ? <div className="flex flex-wrap gap-2">{earnedBadges.slice(0, 4).map(badge => <span key={badge.id} title={`${badge.name}: ${badge.description}`} className="inline-flex items-center gap-2 rounded-xl bg-[#f5f8ee] px-3 py-2 text-xs font-semibold text-emerald-900"><Award size={15} className="text-emerald-700" />{badge.name}</span>)}</div> : <p className="text-sm text-emerald-900/50">Your first badge is waiting in the making.</p>}
        </Panel>
        <Panel title="In your orbit" subtitle={activeChallenges.length ? 'Active challenges' : 'A little structure, if you want it'} action={<Link href="/challenges" className="text-xs font-bold text-emerald-800">Browse</Link>}>
          {activeChallenges.length ? <div className="grid gap-3">{activeChallenges.slice(0, 2).map(challenge => <ChallengeMini key={challenge.id} challenge={challenge} />)}</div> : <p className="text-sm text-emerald-900/50">There’s no rush. Explore challenges when it feels right.</p>}
        </Panel>
      </div>
    </div>
  </div>;
}

function ActivityRow({ item, onClick }: { item: ActivityRecord; onClick?: () => void }) {
  const content = <><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9f3eb] text-emerald-800"><Activity size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-emerald-950">{item.activityName}</span><span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-900/50"><CategoryTag category={item.category} /><span>{formattedDate(item.createdAt)}</span></span></span><span className="hidden text-right sm:block"><span className="block text-xs font-semibold text-emerald-950">{item.pointsEarned} pts</span><span className="text-[10px] text-emerald-900/45">{item.recommendations?.length ?? 0} ideas</span></span><ChevronRight size={17} className="shrink-0 text-emerald-900/30" /></>;
  return onClick ? <button onClick={onClick} className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-emerald-50/60" data-testid={`button-open-activity-${item.id}`}>{content}</button> : <Link href={`/history/${item.id}`} className="flex items-center gap-3 py-4 transition hover:bg-emerald-50/60" data-testid={`link-activity-${item.id}`}>{content}</Link>;
}
function ChallengeMini({ challenge }: { challenge: ChallengeProgress }) {
  return <div className="rounded-xl bg-[#f6f9f5] p-3"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-bold text-emerald-950">{challenge.title}</span><span className="shrink-0 text-xs font-semibold text-emerald-900/50">{challenge.progress}/{challenge.targetCount}</span></div><div className="mt-2"><ProgressBar value={challenge.progress} max={challenge.targetCount} /></div></div>;
}

function AnalysePage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<ActivityRecord | null>(null);
  const mutation = useAnalyzeActivity();
  const complete = useCompleteRecommendation();
  const queryClient = useQueryClient();
  const { notice, notify } = useNotice();
  const [completionMessage, setCompletionMessage] = useState('');
  async function analyze(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (value.length < 8) { notify('Add a little more detail—at least 8 characters.', 'error'); return; }
    try {
      const response = await mutation.mutateAsync({ data: { inputText: value } });
      setResult(response.activity);
      setCompletionMessage('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetBadgesQueryKey() }),
      ]);
      notify('Your activity has been saved with ideas to explore.');
    } catch (error) { notify(error instanceof Error ? error.message : 'We couldn’t analyse that activity. Please try again.', 'error'); }
  }
  async function markComplete(recommendationId: string) {
    try {
      const response = await complete.mutateAsync({ recommendationId });
      setResult(current => current ? { ...current, recommendations: current.recommendations.map(rec => rec.id === recommendationId ? response.recommendation : rec) } : current);
      setCompletionMessage(`You earned ${response.recommendation.points} points. Your streak is now ${response.profile.currentStreak} ${response.profile.currentStreak === 1 ? 'day' : 'days'}.${response.newBadges.length ? ` New badge${response.newBadges.length > 1 ? 's' : ''}: ${response.newBadges.map(badge => badge.name).join(', ')}.` : ''}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetActivitiesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetActivityQueryKey(response.recommendation.activityId) }),
        queryClient.invalidateQueries({ queryKey: getGetBadgesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetChallengesQueryKey() }),
      ]);
    } catch (error) { notify(error instanceof Error ? error.message : 'We couldn’t update your progress. Try again.', 'error'); }
  }
  return <div className="page-enter"><PageTitle eyebrow="A little curiosity goes a long way" title="Analyse an activity" detail="Describe a routine as it is today. EcoWise will return practical alternatives for you to consider." />
    <div className="grid gap-5 xl:grid-cols-[.95fr_1.05fr]">
      <Panel title="What does this look like for you?" subtitle="A sentence or two is enough. Your own words work best.">
        <form onSubmit={analyze} className="grid gap-4"><TextArea label="Describe your routine" value={input} onChange={e => setInput(e.target.value.slice(0, 1200))} minLength={8} maxLength={1200} placeholder="For example: I usually drive to work, about 20 minutes each way…" rows={7} data-testid="textarea-activity" /><div className="flex items-center justify-between gap-3"><span className={`text-xs ${input.length > 1160 ? 'text-amber-700' : 'text-emerald-900/45'}`}>{input.length} / 1,200 characters</span><Btn disabled={mutation.isPending || input.trim().length < 8} type="submit">{mutation.isPending ? <><span className="h-4 w-4 animate-pulse rounded-full bg-white/50" />Thinking…</> : <><Sparkles size={16} />Find ideas</>}</Btn></div></form>
        {mutation.isError && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{mutation.error instanceof Error ? mutation.error.message : 'Your activity could not be analysed.'}</p>}
        <div className="mt-6 rounded-2xl bg-[#f5f8f3] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-emerald-800">A useful starting point</p><p className="mt-2 text-sm leading-6 text-emerald-950/60">Mention what you do, how often it happens, and anything that matters to you. There’s no need to have a solution in mind.</p></div>
      </Panel>
      <div className="min-w-0">
        {result ? <div className="grid gap-5">
          <Panel title={result.activityName} subtitle={`Saved ${formattedDate(result.createdAt)}`} action={<CategoryTag category={result.category} />}>
            <p className="text-sm leading-6 text-emerald-950/70">{result.analysis}</p><div className="mt-4 grid gap-2 rounded-2xl bg-[#f5f8f3] p-4 text-sm sm:grid-cols-2"><div><span className="text-xs font-semibold text-emerald-900/45">Your current choice</span><p className="mt-1 font-semibold text-emerald-950">{result.currentChoice}</p></div><div><span className="text-xs font-semibold text-emerald-900/45">Frequency</span><p className="mt-1 font-semibold text-emerald-950">{result.frequency}</p></div></div>
          </Panel>
          {completionMessage && <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-800"><Trophy size={18} /></span><div><p className="text-sm font-bold text-emerald-950">Progress noted</p><p className="mt-1 text-sm leading-5 text-emerald-900/70">{completionMessage}</p></div></div>}
          <Panel title="Ideas to explore" subtitle="Choose any that fit your life. There’s no pressure to do them all.">
            {result.recommendations?.length ? <div className="grid gap-3">{result.recommendations.map(recommendation => <article key={recommendation.id} className="rounded-2xl border border-emerald-100 bg-[#fcfdfb] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="font-display text-base font-extrabold text-emerald-950">{recommendation.title}</h3><p className="mt-2 text-sm leading-6 text-emerald-950/65">{recommendation.description}</p></div>{recommendation.isCompleted ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800"><CheckCircle2 size={14} />Tried</span> : <Btn onClick={() => markComplete(recommendation.id)} disabled={complete.isPending} variant="soft" className="shrink-0" data-testid={`button-complete-${recommendation.id}`}>{complete.isPending ? 'Saving…' : <><Check size={15} />I tried this</>}</Btn>}</div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-emerald-100 pt-3"><CategoryTag category={recommendation.category} /><span className="rounded-full bg-[#f4f2e7] px-2.5 py-1 text-xs font-semibold text-amber-900">{recommendation.difficulty}</span><span className="rounded-full bg-[#e9f5f1] px-2.5 py-1 text-xs font-semibold text-teal-900">{recommendation.points} points</span><span className="text-xs text-emerald-900/45">{recommendation.estimatedImpact}</span></div></article>)}</div> : <EmptyState title="No ideas came back" detail="Try describing your activity with a little more context." />}
          </Panel>
        </div> : <EmptyState icon={Sparkles} title="Your ideas will appear here" detail="After you submit an activity, you’ll see the analysis and recommendations returned for that routine." />}
      </div>
    </div><Notice notice={notice} close={() => notify('', 'success')} />
  </div>;
}

function HistoryPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const params = useMemo(() => ({ ...(category ? { category: category as typeof ActivityCategory[keyof typeof ActivityCategory] } : {}), ...(search.trim() ? { search: search.trim() } : {}) }), [category, search]);
  const query = useGetActivities(params);
  return <div className="page-enter"><PageTitle eyebrow="Your personal record" title="Activity history" detail="Revisit what you’ve explored and the alternatives you saved." right={<Link href="/analyse" className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white hover:bg-emerald-900"><Sparkles size={15} />New analysis</Link>} />
    <Panel className="mb-5 p-4 sm:p-5"><div className="grid gap-3 md:grid-cols-[1fr_230px]"><label className="relative"><span className="sr-only">Search activities</span><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-900/40" /><input value={search} onChange={e => setSearch(e.target.value)} maxLength={120} placeholder="Search activities…" className="h-11 w-full rounded-xl border border-emerald-100 bg-[#fbfdfb] pl-11 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" data-testid="input-search-history" /></label><Select label="Filter by category" aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)} className="h-11"><option value="">All categories</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</Select></div></Panel>
    {query.isLoading ? <LoadingPanel label="Loading activity history" /> : query.isError ? <ErrorPanel onRetry={() => query.refetch()} message="Your history could not be loaded. Try again in a moment." /> : query.data?.length ? <Panel title={`${query.data.length} ${query.data.length === 1 ? 'activity' : 'activities'}`} subtitle="Select an activity to see the recommendations"><div className="divide-y divide-emerald-100">{query.data.map(item => <ActivityRow key={item.id} item={item} />)}</div></Panel> : <EmptyState icon={search || category ? Search : Clock3} title={search || category ? 'Nothing matches yet' : 'Your history is waiting'} detail={search || category ? 'Try another search or clear the category filter.' : 'Activities you analyse will be saved here, along with the recommendations.'} action={search || category ? <Btn variant="soft" onClick={() => { setSearch(''); setCategory(''); }}>Clear filters</Btn> : <Link href="/analyse" className="text-sm font-bold text-emerald-800">Explore an activity <ArrowRight size={14} className="ml-1 inline" /></Link>} />}
  </div>;
}
function ActivityDetailPage() {
  const params = useParams<{ id: string }>();
  const query = useGetActivity(params.id);
  const complete = useCompleteRecommendation();
  const client = useQueryClient();
  const { notice, notify } = useNotice();
  const [completionMessage, setCompletionMessage] = useState('');
  async function markComplete(recommendationId: string) {
    try {
      const response = await complete.mutateAsync({ recommendationId });
      await Promise.all([client.invalidateQueries({ queryKey: getGetActivityQueryKey(params.id) }), client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }), client.invalidateQueries({ queryKey: getGetActivitiesQueryKey() }), client.invalidateQueries({ queryKey: getGetBadgesQueryKey() }), client.invalidateQueries({ queryKey: getGetChallengesQueryKey() })]);
      setCompletionMessage(`You earned ${response.recommendation.points} points. Your streak is now ${response.profile.currentStreak} ${response.profile.currentStreak === 1 ? 'day' : 'days'}.${response.newBadges.length ? ` New badge${response.newBadges.length > 1 ? 's' : ''}: ${response.newBadges.map(badge => badge.name).join(', ')}.` : ''}`);
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not update your progress.', 'error'); }
  }
  if (query.isLoading) return <LoadingPanel label="Loading activity detail" />;
  if (query.isError || !query.data) return <div><Link href="/history" className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-emerald-800"><ChevronLeft size={16} />Back to history</Link><ErrorPanel onRetry={() => query.refetch()} message="This activity could not be opened." /></div>;
  const activity = query.data;
  return <div className="page-enter"><Link href="/history" className="mb-5 inline-flex items-center gap-1 text-sm font-bold text-emerald-800"><ChevronLeft size={16} />Back to history</Link><PageTitle eyebrow={`Saved ${formattedDate(activity.createdAt)}`} title={activity.activityName} detail={activity.inputText} right={<CategoryTag category={activity.category} />} />
    <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><Panel title="Analysis" subtitle="A reflection on your current routine"><p className="text-sm leading-7 text-emerald-950/70">{activity.analysis}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-[#f5f8f3] p-4"><p className="text-xs font-semibold text-emerald-900/45">Current choice</p><p className="mt-1 text-sm font-bold text-emerald-950">{activity.currentChoice}</p></div><div className="rounded-xl bg-[#f5f8f3] p-4"><p className="text-xs font-semibold text-emerald-900/45">Frequency</p><p className="mt-1 text-sm font-bold text-emerald-950">{activity.frequency}</p></div><div className="rounded-xl bg-[#f5f8f3] p-4"><p className="text-xs font-semibold text-emerald-900/45">Impact level</p><p className="mt-1 text-sm font-bold text-emerald-950">{activity.impactLevel}</p></div><div className="rounded-xl bg-[#f5f8f3] p-4"><p className="text-xs font-semibold text-emerald-900/45">Points earned</p><p className="mt-1 text-sm font-bold text-emerald-950">{activity.pointsEarned}</p></div></div></Panel><div className="grid content-start gap-4">{completionMessage && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">{completionMessage}</div>}<Panel title="Recommendations" subtitle="Ideas connected to this activity">{activity.recommendations.length ? <div className="grid gap-3">{activity.recommendations.map(rec => <div key={rec.id} className="rounded-2xl border border-emerald-100 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex-1"><h3 className="font-display font-extrabold text-emerald-950">{rec.title}</h3><p className="mt-2 text-sm leading-6 text-emerald-950/65">{rec.description}</p></div>{rec.isCompleted ? <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">Completed</span> : <Btn variant="soft" disabled={complete.isPending} onClick={() => markComplete(rec.id)} data-testid={`button-complete-${rec.id}`}><Check size={15} />I tried this</Btn>}</div><div className="mt-3 flex flex-wrap gap-2"><CategoryTag category={rec.category} /><span className="rounded-full bg-[#f4f2e7] px-2.5 py-1 text-xs font-semibold text-amber-900">{rec.difficulty}</span><span className="rounded-full bg-[#e9f5f1] px-2.5 py-1 text-xs font-semibold text-teal-900">{rec.points} points</span><span className="self-center text-xs text-emerald-900/45">{rec.estimatedImpact}</span></div></div>)}</div> : <EmptyState title="No recommendations saved" detail="This activity has no recommendations to show." />}</Panel></div></div>
    <Notice notice={notice} close={() => notify('', 'success')} />
  </div>;
}

function ChallengesPage() {
  const query = useGetChallenges();
  const join = useJoinChallenge();
  const client = useQueryClient();
  const { notice, notify } = useNotice();
  async function joinChallenge(id: string) {
    try {
      await join.mutateAsync({ challengeId: id });
      await Promise.all([client.invalidateQueries({ queryKey: getGetChallengesQueryKey() }), client.invalidateQueries({ queryKey: getGetDashboardQueryKey() })]);
      notify('You joined the challenge. Take it at your own pace.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Could not join this challenge.', 'error'); }
  }
  return <div className="page-enter"><PageTitle eyebrow="Try something together" title="Challenges" detail="Gentle prompts for building habits. Join the ones that feel right for you." />
    {query.isLoading ? <LoadingPanel label="Loading challenges" /> : query.isError ? <ErrorPanel onRetry={() => query.refetch()} message="Challenges aren’t available right now." /> : query.data?.length ? <div className="grid gap-4 lg:grid-cols-2">{query.data.map((challenge: ChallengeProgress, index) => <article key={challenge.id} className={`rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_6px_22px_rgba(30,74,58,.045)] sm:p-6 ${index === 0 ? 'lg:col-span-2 lg:grid lg:grid-cols-[1fr_280px] lg:items-center lg:gap-8' : ''}`}><div><div className="flex items-start justify-between gap-4"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${index % 2 ? 'bg-[#e8f2e8] text-emerald-800' : 'bg-[#e4f2ed] text-teal-800'}`}><Target size={21} /></span>{challenge.completed ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800"><CheckCircle2 size={14} />Complete</span> : challenge.joined ? <span className="rounded-full bg-[#e8f3ef] px-3 py-1.5 text-xs font-bold text-teal-900">Joined</span> : <span className="rounded-full bg-[#f5f4eb] px-3 py-1.5 text-xs font-bold text-amber-900">Open</span>}</div><h2 className="mt-5 font-display text-xl font-extrabold tracking-[-.04em] text-emerald-950">{challenge.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-950/60">{challenge.description}</p><div className="mt-4 flex flex-wrap gap-2">{challenge.category && <CategoryTag category={challenge.category} />}<span className="rounded-full bg-[#e9f5f1] px-2.5 py-1 text-xs font-semibold text-teal-900">{challenge.points} points</span><span className="rounded-full bg-[#f4f8f3] px-2.5 py-1 text-xs font-semibold text-emerald-900/65">{challenge.durationDays} days</span></div></div><div className="mt-6 lg:mt-0"><div className="mb-2 flex justify-between text-xs font-semibold text-emerald-900/55"><span>Progress</span><span>{challenge.progress} / {challenge.targetCount}</span></div><ProgressBar value={challenge.progress} max={challenge.targetCount} /><p className="mt-3 text-xs leading-5 text-emerald-900/50">{challenge.joined ? 'Keep adding activities that match this challenge.' : 'Join whenever you’re ready to begin.'}</p>{!challenge.joined && !challenge.completed && <Btn className="mt-4 w-full" disabled={join.isPending} onClick={() => joinChallenge(challenge.id)} data-testid={`button-join-${challenge.id}`}>{join.isPending ? 'Joining…' : <>Join challenge <ArrowRight size={15} /></>}</Btn>}</div></article>)}</div> : <EmptyState icon={Target} title="No challenges available just yet" detail="When challenges become available for your account, they’ll show up here." />}
    <Notice notice={notice} close={() => notify('', 'success')} />
  </div>;
}

function BadgesPage() {
  const query = useGetBadges();
  return <div className="page-enter"><PageTitle eyebrow="Your milestones" title="Badges" detail="A record of the routines you’ve explored and the progress you’ve made." />
    {query.isLoading ? <LoadingPanel label="Loading badges" /> : query.isError ? <ErrorPanel onRetry={() => query.refetch()} message="Your badges could not be loaded." /> : query.data?.length ? <>
      <div className="mb-5 rounded-[22px] border border-emerald-100 bg-white p-5 shadow-[0_6px_22px_rgba(30,74,58,.045)]"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-emerald-700">Badge collection</p><p className="mt-1 font-display text-xl font-extrabold text-emerald-950">{query.data.filter(badge => badge.earnedAt).length} <span className="text-sm font-semibold text-emerald-900/45">of {query.data.length} earned</span></p></div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f4f0de] text-amber-800"><Trophy size={22} /></span></div><div className="mt-4"><ProgressBar value={query.data.filter(badge => badge.earnedAt).length} max={query.data.length} /></div></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{query.data.map((badge: BadgeProgress) => { const earned = Boolean(badge.earnedAt); const progress = Math.min(badge.progress, badge.requirementValue); return <article key={badge.id} className={`rounded-[22px] border p-5 ${earned ? 'border-emerald-200 bg-white shadow-[0_6px_22px_rgba(30,74,58,.045)]' : 'border-emerald-100/80 bg-[#f7faf6]'}`}><div className="flex items-start justify-between"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${earned ? 'bg-[#f7efd5] text-amber-800' : 'bg-emerald-100/70 text-emerald-900/40'}`}><Award size={22} /></span>{earned ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800"><Check size={12} />Earned</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2.5 py-1 text-[11px] font-bold text-emerald-900/45"><LockKeyhole size={11} />In progress</span>}</div><h2 className="mt-5 font-display text-lg font-extrabold tracking-[-.035em] text-emerald-950">{badge.name}</h2><p className="mt-1 min-h-10 text-sm leading-5 text-emerald-900/55">{badge.description}</p><div className="mt-5"><div className="mb-2 flex justify-between text-xs font-semibold text-emerald-900/50"><span>{earned ? `Earned ${formattedDate(badge.earnedAt)}` : 'Progress'}</span>{!earned && <span>{progress} / {badge.requirementValue}</span>}</div><ProgressBar value={progress} max={badge.requirementValue} /></div></article>; })}</div>
    </> : <EmptyState icon={Award} title="Your collection is ready" detail="Badges become available as you log activities and complete recommendations." action={<Link href="/analyse" className="text-sm font-bold text-emerald-800">Explore an activity <ArrowRight size={14} className="ml-1 inline" /></Link>} />}
  </div>;
}

function ProfilePage() {
  const dashboardQuery = useGetDashboard();
  const profile = dashboardQuery.data?.profile;
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [category, setCategory] = useState('');
  const [initialized, setInitialized] = useState(false);
  const mutation = useUpdateProfile();
  const client = useQueryClient();
  const { notice, notify } = useNotice();
  useEffect(() => {
    if (profile && !initialized) { setName(profile.fullName); setAvatarUrl(profile.avatarUrl ?? ''); setCategory(profile.preferredCategory ?? ''); setInitialized(true); }
  }, [profile, initialized]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { notify('Your name can’t be empty.', 'error'); return; }
    try {
      await mutation.mutateAsync({ data: { fullName: name.trim(), avatarUrl: avatarUrl.trim() || null, preferredCategory: category ? category as typeof ActivityCategory[keyof typeof ActivityCategory] : null } });
      await client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      notify('Your profile has been updated.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Your profile could not be saved.', 'error'); }
  }
  if (dashboardQuery.isLoading) return <LoadingPanel label="Loading profile" />;
  if (dashboardQuery.isError || !profile) return <ErrorPanel onRetry={() => dashboardQuery.refetch()} message="Your profile could not be loaded." />;
  return <div className="page-enter"><PageTitle eyebrow="Make it yours" title="Your profile" detail="Keep your name and preferences up to date." />
    <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
      <Panel><div className="flex flex-col items-center text-center"><Avatar profile={{ fullName: name || profile.fullName, avatarUrl: avatarUrl || null }} size="lg" /><h2 className="mt-4 font-display text-xl font-extrabold text-emerald-950">{name || profile.fullName}</h2><p className="mt-1 text-sm text-emerald-900/50">{profile.email}</p><div className="mt-6 grid w-full grid-cols-2 gap-3"><div className="rounded-xl bg-[#f5f8f3] p-3"><span className="block font-display text-xl font-extrabold text-emerald-950">{profile.totalPoints}</span><span className="text-xs text-emerald-900/50">points</span></div><div className="rounded-xl bg-[#f5f8f3] p-3"><span className="block font-display text-xl font-extrabold text-emerald-950">{profile.currentStreak}</span><span className="text-xs text-emerald-900/50">day streak</span></div></div></div></Panel>
      <Panel title="Profile details" subtitle="Only information you choose to share with EcoWise."><form onSubmit={submit} className="grid gap-5"><Field label="Full name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required data-testid="input-profile-name" /><Field label="Avatar image URL" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} type="url" placeholder="https://…" hint="Optional. Leave blank to use your initials." data-testid="input-avatar-url" /><Select label="Area you’d like to focus on" value={category} onChange={e => setCategory(e.target.value)} data-testid="select-profile-category"><option value="">No preference</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</Select>{mutation.isError && <p role="alert" className="text-sm text-rose-700">{mutation.error instanceof Error ? mutation.error.message : 'Could not save changes.'}</p>}<div className="flex justify-end"><Btn type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : <><Check size={15} />Save changes</>}</Btn></div></form></Panel>
    </div><Notice notice={notice} close={() => notify('', 'success')} />
  </div>;
}
function SettingsPage() {
  const { session } = useAuth();
  const [path, setPath] = useLocation();
  const client = useQueryClient();
  const profileQuery = useGetDashboard();
  const [category, setCategory] = useState('');
  const [ready, setReady] = useState(false);
  const update = useUpdateProfile();
  const { notice, notify } = useNotice();
  useEffect(() => { if (profileQuery.data?.profile && !ready) { setCategory(profileQuery.data.profile.preferredCategory ?? ''); setReady(true); } }, [profileQuery.data, ready]);
  async function savePreference(event: FormEvent) {
    event.preventDefault();
    try {
      await update.mutateAsync({ data: { preferredCategory: category ? category as typeof ActivityCategory[keyof typeof ActivityCategory] : null } });
      await client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      notify('Your preference has been saved.');
    } catch (error) { notify(error instanceof Error ? error.message : 'Preference could not be saved.', 'error'); }
  }
  async function logout() { await supabase.auth.signOut(); client.clear(); setPath('/'); }
  return <div className="page-enter"><PageTitle eyebrow="Your account" title="Settings" detail="Manage your EcoWise preferences and sign-in." />
    {profileQuery.isLoading ? <LoadingPanel label="Loading settings" /> : profileQuery.isError ? <ErrorPanel onRetry={() => profileQuery.refetch()} message="Account settings could not be loaded." /> : <div className="grid max-w-3xl gap-5">
      <Panel title="Your focus" subtitle="Choose an area you’d like EcoWise to keep in mind."><form onSubmit={savePreference} className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><Select label="Preferred category" value={category} onChange={e => setCategory(e.target.value)} data-testid="select-preference"><option value="">No preference</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</Select><Btn type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save preference'}</Btn></form>{update.isError && <p role="alert" className="mt-3 text-sm text-rose-700">{update.error instanceof Error ? update.error.message : 'Preference could not be saved.'}</p>}</Panel>
      <Panel title="Sign-in details" subtitle="Your EcoWise account is secured by Supabase authentication."><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold text-emerald-900/45">Email address</p><p className="mt-1 font-semibold text-emerald-950">{session?.user.email || 'Not available'}</p></div><Link href="/forgot-password" className="rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Reset password</Link></div></Panel>
      <Panel title="Sign out" subtitle="You can log back in any time."><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-emerald-950/60">End this EcoWise session on this device.</p><Btn variant="outline" onClick={logout}><LogOut size={15} />Log out</Btn></div></Panel>
    </div>}
    <Notice notice={notice} close={() => notify('', 'success')} />
  </div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function AppRoutes() {
  const { loading } = useAuth();
  if (loading) return <div className="grid min-h-[100dvh] place-items-center bg-[#f2f8f3]"><div className="w-64 space-y-3"><Skeleton className="h-10 w-10 rounded-2xl" /><Skeleton className="h-6 w-44" /><Skeleton className="h-4 w-60" /></div></div>;
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={Landing} />
    <Route path="/login"><AuthPage mode="login" /></Route>
    <Route path="/signup"><AuthPage mode="signup" /></Route>
    <Route path="/forgot-password"><AuthPage mode="forgot" /></Route>
    <Route path="/dashboard"><Protected><DashboardPage /></Protected></Route>
    <Route path="/analyse"><Protected><AnalysePage /></Protected></Route>
    <Route path="/history"><Protected><HistoryPage /></Protected></Route>
    <Route path="/history/:id"><Protected><ActivityDetailPage /></Protected></Route>
    <Route path="/challenges"><Protected><ChallengesPage /></Protected></Route>
    <Route path="/badges"><Protected><BadgesPage /></Protected></Route>
    <Route path="/profile"><Protected><ProfilePage /></Protected></Route>
    <Route path="/settings"><Protected><SettingsPage /></Protected></Route>
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}
function App() {
  const [auth, setAuth] = useState<AuthState>({ session: null, loading: true });
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setAuth({ session: data.session, loading: false }); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setAuth({ session, loading: false }); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  return <QueryClientProvider client={queryClient}><TooltipProvider><AuthContext.Provider value={auth}><div className="grain"><AppRoutes /></div></AuthContext.Provider><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
