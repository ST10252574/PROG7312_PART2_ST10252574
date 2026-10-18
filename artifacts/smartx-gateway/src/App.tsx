import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronRight,
  Cloud,
  Database,
  Gauge,
  History,
  Info,
  LayoutDashboard,
  Menu,
  Radio,
  RefreshCw,
  Router as RouterIcon,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Thermometer,
  Timer,
  UploadCloud,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetEngagementStrategyQueryKey,
  getGetEngagementCheckInStatusQueryKey,
  getGetGatewaySummaryQueryKey,
  getListActivityQueryKey,
  getListCommandHistoryQueryKey,
  getListCommandsQueryKey,
  getListDevicesQueryKey,
  getListRecommendationsQueryKey,
  getListSearchEventsQueryKey,
  getListSensorsQueryKey,
  getListTelemetryQueryKey,
  useCreateCommand,
  useCreateEngagementCheckIn,
  useCreateSearchEvent,
  useCreateSensor,
  useGetEngagementStrategy,
  useGetEngagementCheckInStatus,
  useGetGatewaySummary,
  useIngestTelemetry,
  useListActivity,
  useListCommandHistory,
  useListCommands,
  useListDevices,
  useListRecommendations,
  useListSearchEvents,
  useListSensors,
  useListTelemetry,
  useResolveRecommendation,
  useUpdateEngagementStrategy,
  useValidateTelemetry,
} from '@workspace/api-client-react';
import type {
  ActivityEvent,
  DeviceCommand,
  DeviceCommandAction,
  DeviceCommandInput,
  Recommendation,
  EngagementStrategy,
  EngagementStrategyInput,
  Sensor,
  TelemetryInput,
  TelemetryReading,
  ValidationResult,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Link, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'Home', icon: RouterIcon },
  { href: '/about', label: 'About Smart-X', icon: Info },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/commands', label: 'Command stream', icon: Send },
  { href: '/command-history', label: 'Command history', icon: History },
  { href: '/sensors', label: 'Sensors', icon: Radio },
  { href: '/telemetry', label: 'Telemetry', icon: Activity },
  { href: '/engagement', label: 'Engagement', icon: Users },
  { href: '#topology', label: 'Network topology', icon: Wifi, disabled: true },
];

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
};

function StatusPill({ status }: { status: string }) {
  const tone = status === 'online' || status === 'valid' || status === 'success'
    ? 'bg-teal-50 text-teal-700 border-teal-200'
    : status === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : status === 'rejected' || status === 'offline'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${tone}`} data-testid={`status-pill-${status}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

function MetricCard({ label, value, detail, icon: Icon, accent = 'teal', trend }: { label: string; value: string | number; detail: string; icon: typeof Gauge; accent?: 'teal' | 'amber' | 'slate' | 'rose'; trend?: 'up' | 'down' }) {
  const accentMap = { teal: 'bg-teal-50 text-teal-700', amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-100 text-slate-700', rose: 'bg-rose-50 text-rose-700' };
  return <div className="group rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_4px_20px_rgba(33,59,71,.045)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_26px_rgba(33,59,71,.08)]" data-testid={`metric-card-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="flex items-start justify-between"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentMap[accent]}`}><Icon size={18} strokeWidth={1.8} /></div>{trend && <span className={`flex items-center gap-1 text-xs font-semibold ${trend === 'up' ? 'text-teal-700' : 'text-amber-700'}`}>{trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} today</span>}</div>
    <div className="mt-5 text-3xl font-extrabold tracking-[-.04em] text-slate-900" data-testid={`value-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</div>
    <div className="mt-1 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-600">{label}</p><p className="text-right text-xs text-slate-400">{detail}</p></div>
  </div>;
}

function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton rounded-lg ${className}`} />; }

function QueryError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-rose-800" data-testid="error-state"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><div><p className="font-bold">Could not load {label}</p><p className="mt-1 text-sm text-rose-700">The gateway did not respond. Retry when the connection is available.</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-800" data-testid={`button-retry-${label.toLowerCase()}`}><RefreshCw size={14} />Retry</button></div></div></div>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Database; title: string; detail: string }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-14 text-center" data-testid="empty-state"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-500"><Icon size={21} /></div><p className="mt-4 font-bold text-slate-800">{title}</p><p className="mt-1 max-w-sm text-sm text-slate-500">{detail}</p></div>;
}

function PageHeader({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[11px] font-medium uppercase tracking-[.18em] text-teal-700">{eyebrow}</p><h1 className="mt-2 text-3xl font-extrabold tracking-[-.045em] text-slate-900 sm:text-[2.25rem]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{detail}</p></div>{action}</div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="noise min-h-[100dvh] bg-[#edf3f5] text-slate-900">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-[#172d3a] text-slate-100 shadow-2xl transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[88px] items-center gap-3 border-b border-white/10 px-6"><div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#35c2b0] text-[#102833]"><RouterIcon size={22} strokeWidth={2.3} /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#172d3a] bg-[#f2bd4e]" /></div><div><p className="text-[17px] font-extrabold tracking-[-.04em]">smart<span className="text-[#4ed6c2]">-x</span></p><p className="font-mono text-[9px] uppercase tracking-[.2em] text-slate-400">gateway control</p></div><button type="button" onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/10 lg:hidden" data-testid="button-close-menu"><X size={18} /></button></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-7"><p className="px-3 font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">workspace</p><nav className="mt-3 space-y-1">{navItems.map(({ href, label, icon: Icon, disabled }) => disabled ? <div key={href} className="group flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600" title="Future work: PoE network mapping is not available yet." aria-disabled="true" data-testid="nav-disabled-topology"><Icon size={17} className="text-slate-600" /><span className="flex-1">{label}</span><span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-slate-500">Future</span></div> : <Link href={href} key={href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${location === href ? 'bg-[#234451] text-white shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon size={17} className={location === href ? 'text-[#4ed6c2]' : 'text-slate-500 group-hover:text-slate-300'} /><span>{label}</span>{location === href && <ChevronRight size={15} className="ml-auto text-[#4ed6c2]" />}</Link>)}</nav></div>
      <div className="mt-auto p-4"><div className="rounded-2xl border border-white/10 bg-white/[.045] p-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-200"><span className="h-2 w-2 animate-pulse rounded-full bg-[#4ed6c2]" />Gateway connected</div><p className="mt-2 text-[11px] leading-5 text-slate-500">Johannesburg mesh · production</p><div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10px] text-slate-500"><span>NODE SX-04</span><span className="text-[#4ed6c2]">v2.8.1</span></div></div><p className="mt-4 px-1 text-[10px] text-slate-600">SMART-X TECHNOLOGY VENTURE<br />SOUTH AFRICA / 2024</p></div>
    </aside>
    {mobileOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden" data-testid="button-overlay-close" />}
     <main className="min-h-[100dvh] lg:pl-[248px]"><header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-[#edf3f5]/90 px-5 backdrop-blur-md sm:px-8"><div className="flex items-center gap-3"><button type="button" onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 lg:hidden" data-testid="button-open-menu"><Menu size={19} /></button><div className="hidden h-2 w-2 rounded-full bg-teal-500 sm:block" /><span className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-500">Smart-X / <span className="text-slate-800">{location === '/' ? 'Home' : location.slice(1).replaceAll('-', ' ')}</span></span></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 text-xs font-semibold text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-teal-500" />Live gateway feed</span><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d7e9e7] text-xs font-extrabold text-teal-800" data-testid="avatar-operator">JM</div></div></header><div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10">{children}</div></main>
  </div>;
}

function Overview() {
  const summaryQuery = useGetGatewaySummary();
  const activityQuery = useListActivity();
  const sensorsQuery = useListSensors();
  const summary = summaryQuery.data;
  const sensors = sensorsQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const onlinePercent = summary && summary.registeredSensors ? Math.round((summary.onlineSensors / summary.registeredSensors) * 100) : 0;
  return <><PageHeader eyebrow="Gateway overview" title="A clear view of your mesh." detail="Monitor the pulse of every connected site, from first ingest to field response." action={<button type="button" onClick={() => { summaryQuery.refetch(); activityQuery.refetch(); sensorsQuery.refetch(); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700" data-testid="button-refresh-overview"><RefreshCw size={15} />Refresh feed</button>} />
    {summaryQuery.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="rounded-2xl bg-white p-5"><Skeleton className="h-10 w-10" /><Skeleton className="mt-5 h-9 w-24" /><Skeleton className="mt-2 h-4 w-36" /></div>)}</div> : summaryQuery.isError ? <QueryError label="gateway summary" onRetry={() => summaryQuery.refetch()} /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Registered sensors" value={summary?.registeredSensors ?? 0} detail={`${summary?.onlineSensors ?? 0} currently online`} icon={Radio} />
      <MetricCard label="Online coverage" value={`${onlinePercent}%`} detail="of registered mesh" icon={Wifi} accent="teal" trend="up" />
      <MetricCard label="Readings today" value={(summary?.readingsToday ?? 0).toLocaleString()} detail="accepted + pending" icon={Activity} accent="slate" trend="up" />
      <MetricCard label="Accepted rate" value={`${summary?.acceptedRate ?? 0}%`} detail={`${summary?.alerts ?? 0} alerts to review`} icon={ShieldCheck} accent={summary?.acceptedRate && summary.acceptedRate < 90 ? 'amber' : 'teal'} />
    </div>}
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_4px_20px_rgba(33,59,71,.045)] sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-slate-400">Mesh posture</p><h2 className="mt-1 text-lg font-extrabold tracking-[-.03em] text-slate-900">Connectivity at a glance</h2></div><span className="rounded-lg bg-teal-50 px-2.5 py-1 font-mono text-[10px] font-medium text-teal-700">LIVE</span></div><div className="mt-6 grid gap-5 md:grid-cols-[1fr_auto] md:items-center"><div><div className="flex items-center justify-between text-xs font-semibold"><span className="text-slate-600">Online sensors</span><span className="font-mono text-slate-900">{summary?.onlineSensors ?? 0} / {summary?.registeredSensors ?? 0}</span></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#31b8a8] transition-all duration-500" style={{ width: `${Math.min(100, onlinePercent)}%` }} /></div><div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>Last ingest {formatTime(summary?.lastIngestedAt)}</span><span className="font-semibold text-teal-700">{onlinePercent >= 90 ? 'Stable network' : 'Needs attention'}</span></div></div><div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-slate-100 sm:h-32 sm:w-32" style={{ background: `conic-gradient(#31b8a8 ${onlinePercent * 3.6}deg, #e8eff1 0deg)` }}><div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-extrabold text-slate-900">{onlinePercent}%</span><span className="font-mono text-[9px] uppercase text-slate-400">online</span></div></div></div><div className="mt-7 grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-100 pt-5"><div className="px-3 first:pl-0"><p className="font-mono text-[10px] uppercase text-slate-400">Alerts</p><p className="mt-1 text-xl font-extrabold text-amber-600">{summary?.alerts ?? 0}</p></div><div className="px-3"><p className="font-mono text-[10px] uppercase text-slate-400">Last ingest</p><p className="mt-1 text-sm font-bold text-slate-700">{formatTime(summary?.lastIngestedAt)}</p></div><div className="px-3"><p className="font-mono text-[10px] uppercase text-slate-400">Health</p><p className="mt-1 text-sm font-bold text-teal-700">Operational</p></div></div></section>
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_4px_20px_rgba(33,59,71,.045)] sm:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-slate-400">Signal log</p><h2 className="mt-1 text-lg font-extrabold tracking-[-.03em] text-slate-900">Recent activity</h2></div><Link href="/telemetry" className="text-xs font-bold text-teal-700 hover:text-teal-800" data-testid="link-view-telemetry">View telemetry <ChevronRight className="inline" size={13} /></Link></div>{activityQuery.isLoading ? <div className="mt-6 space-y-5">{[1, 2, 3].map((item) => <div className="flex gap-3" key={item}><Skeleton className="h-2.5 w-2.5 rounded-full" /><div className="flex-1"><Skeleton className="h-4 w-3/4" /><Skeleton className="mt-2 h-3 w-full" /></div></div>)}</div> : activityQuery.isError ? <div className="mt-5"><QueryError label="activity" onRetry={() => activityQuery.refetch()} /></div> : activity.length === 0 ? <div className="mt-5"><EmptyState icon={Activity} title="No activity yet" detail="Gateway events will appear here as the mesh begins sending readings." /></div> : <div className="mt-5 space-y-4">{activity.slice(0, 5).map((event) => <ActivityRow event={event} key={event.id} />)}</div>}</section>
    </div>
     <section className="mt-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_4px_20px_rgba(33,59,71,.045)] sm:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-slate-400">Field inventory</p><h2 className="mt-1 text-lg font-extrabold tracking-[-.03em] text-slate-900">Sensors needing a look</h2></div><Link href="/sensors" className="inline-flex items-center gap-1 text-xs font-bold text-teal-700" data-testid="link-manage-sensors">Manage sensors <ChevronRight size={13} /></Link></div>{sensorsQuery.isLoading ? <div className="mt-5 grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20" />)}</div> : sensors.length === 0 ? <div className="mt-5"><EmptyState icon={Radio} title="No sensors registered" detail="Register the first field device to start building the mesh." /></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{sensors.filter((sensor) => sensor.status !== 'online').slice(0, 4).map((sensor) => <SensorMini sensor={sensor} key={sensor.id} />)}{sensors.filter((sensor) => sensor.status !== 'online').length === 0 && <div className="col-span-full rounded-xl border border-teal-100 bg-teal-50/70 px-4 py-5 text-sm font-semibold text-teal-800">All registered sensors are reporting within expected parameters.</div>}</div>}</section>
     <RecommendationPanel />
     <DailyCheckIn />
  </>;
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const colors = { success: 'bg-teal-500', warning: 'bg-amber-500', info: 'bg-sky-500' };
  return <div className="flex gap-3" data-testid={`activity-event-${event.id}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${colors[event.tone]}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><p className="truncate text-sm font-bold text-slate-800">{event.title}</p><time className="shrink-0 font-mono text-[10px] text-slate-400">{formatTime(event.occurredAt)}</time></div><p className="mt-1 text-xs leading-5 text-slate-500">{event.detail}</p></div></div>;
}

function SensorMini({ sensor }: { sensor: Sensor }) {
  return <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3" data-testid={`sensor-mini-${sensor.id}`}><div className="flex min-w-0 items-center gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm">{sensor.category === 'power' ? <Zap size={15} /> : sensor.category === 'actuator' ? <Settings2 size={15} /> : <Thermometer size={15} />}</div><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{sensor.location}</p><p className="font-mono text-[10px] text-slate-400">{sensor.macAddress}</p></div></div><StatusPill status={sensor.status} /></div>;
}

function Sensors() {
  const query = useListSensors();
  const create = useCreateSensor();
  const client = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ macAddress: '', location: '', category: 'environmental' as 'environmental' | 'power' | 'actuator' });
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | Sensor['category']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Sensor['status']>('all');
  const sensors = query.data ?? [];
  const visibleSensors = sensors.filter((sensor) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${sensor.location} ${sensor.macAddress} ${sensor.category}`.toLowerCase().includes(query);
    return matchesSearch &&
      (categoryFilter === 'all' || sensor.category === categoryFilter) &&
      (statusFilter === 'all' || sensor.status === statusFilter);
  });
  const submit = (event: React.FormEvent) => { event.preventDefault(); setMessage(''); create.mutate({ data: form }, { onSuccess: () => { setForm({ macAddress: '', location: '', category: 'environmental' }); setShowForm(false); setMessage('Sensor registered and ready for ingest.'); client.invalidateQueries({ queryKey: getListSensorsQueryKey() }); client.invalidateQueries({ queryKey: getGetGatewaySummaryQueryKey() }); client.invalidateQueries({ queryKey: getListActivityQueryKey() }); }, onError: () => setMessage('Registration failed. Check the device details and try again.') }); };
  return <><PageHeader eyebrow="Field inventory" title="Sensors" detail="Register devices and see where the mesh needs attention." action={<button type="button" onClick={() => setShowForm((visible) => !visible)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1c8f84] px-4 py-2.5 text-xs font-bold text-white shadow-[0_6px_16px_rgba(28,143,132,.2)] transition hover:bg-[#15796f]" data-testid="button-register-sensor"><Radio size={15} />Register sensor</button>} />
    {message && <div className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${message.includes('failed') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-800'}`} data-testid="status-sensor-form"><Check size={16} />{message}</div>}
    {showForm && <form onSubmit={submit} className="mb-6 rounded-2xl border border-teal-200 bg-[#f8fffd] p-5 shadow-sm sm:p-6" data-testid="form-register-sensor"><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-teal-700">New field device</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Add a sensor to the mesh</h2></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1 text-slate-400 hover:bg-teal-50" data-testid="button-cancel-register"><X size={18} /></button></div><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-xs font-bold text-slate-700">MAC address<input required minLength={12} value={form.macAddress} onChange={(event) => setForm({ ...form, macAddress: event.target.value })} placeholder="e.g. A4:C1:38:9D:20:7F" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 font-mono text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="input-sensor-mac" /></label><label className="text-xs font-bold text-slate-700">Location<input required minLength={2} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="e.g. Braamfontein hub" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="input-sensor-location" /></label><label className="text-xs font-bold text-slate-700">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as typeof form.category })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="select-sensor-category"><option value="environmental">Environmental</option><option value="power">Power</option><option value="actuator">Actuator</option></select></label></div><div className="mt-5 flex justify-end"><button type="submit" disabled={create.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#1c8f84] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50" data-testid="button-submit-sensor">{create.isPending ? 'Registering…' : 'Register sensor'}<ChevronRight size={15} /></button></div></form>}
    {query.isLoading ? <div className="space-y-3">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[77px]" />)}</div> : query.isError ? <QueryError label="sensors" onRetry={() => query.refetch()} /> : sensors.length === 0 ? <EmptyState icon={Radio} title="Your mesh is waiting" detail="Register a sensor to see its health, last seen time and daily reading volume here." /> : <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(33,59,71,.045)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="font-extrabold tracking-[-.025em] text-slate-900">Registered devices <span className="ml-1 font-mono text-xs font-medium text-slate-400">{visibleSensors.length} / {sensors.length}</span></h2><p className="mt-1 text-xs text-slate-500">Search by location, MAC address or category, then narrow by category and live status.</p></div><div className="flex items-center gap-3 text-xs"><span className="flex items-center gap-1.5 font-semibold text-teal-700"><span className="h-2 w-2 rounded-full bg-teal-500" />{sensors.filter((sensor) => sensor.status === 'online').length} online</span><span className="flex items-center gap-1.5 font-semibold text-amber-700"><span className="h-2 w-2 rounded-full bg-amber-500" />{sensors.filter((sensor) => sensor.status === 'warning').length} warning</span></div></div>
      <div className="grid gap-2 border-b border-slate-100 p-4 sm:grid-cols-[1fr_180px_180px] sm:px-6">
        <label className="sr-only" htmlFor="sensor-search">Search sensors</label>
        <input id="sensor-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search location, MAC or category" className="min-w-0 rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-teal-500" data-testid="input-sensor-search" />
        <label className="sr-only" htmlFor="sensor-category-filter">Filter by category</label>
        <select id="sensor-category-filter" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-teal-500" data-testid="filter-sensor-category"><option value="all">All categories</option><option value="environmental">Environmental</option><option value="power">Power</option><option value="actuator">Actuator</option></select>
        <label className="sr-only" htmlFor="sensor-status-filter">Filter by live status</label>
        <select id="sensor-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-teal-500" data-testid="filter-sensor-status"><option value="all">All statuses</option><option value="online">Online</option><option value="warning">Warning</option><option value="offline">Offline</option></select>
      </div>
      {visibleSensors.length === 0 ? <div className="p-5"><EmptyState icon={Search} title="No sensors match these filters" detail="Try another category, status, location or MAC address." /></div> : <div className="divide-y divide-slate-100">{visibleSensors.map((sensor) => <SensorRow sensor={sensor} key={sensor.id} />)}</div>}
    </section>}
  </>;
}

function SensorRow({ sensor }: { sensor: Sensor }) {
  return <div className="grid gap-4 px-5 py-5 transition hover:bg-slate-50/70 sm:grid-cols-[1.3fr_1fr_.8fr_.75fr_auto] sm:items-center sm:px-6" data-testid={`row-sensor-${sensor.id}`}><div className="flex items-center gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${sensor.status === 'online' ? 'bg-teal-50 text-teal-700' : sensor.status === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{sensor.category === 'power' ? <Zap size={18} /> : sensor.category === 'actuator' ? <Settings2 size={18} /> : <Thermometer size={18} />}</div><div><p className="font-bold text-slate-800">{sensor.location}</p><p className="mt-0.5 font-mono text-[10px] text-slate-400">{sensor.macAddress}</p></div></div><div><p className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-400 sm:hidden">Category</p><p className="text-sm font-semibold capitalize text-slate-600">{sensor.category}</p></div><div><p className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-400 sm:hidden">Last seen</p><p className="text-sm font-semibold text-slate-700">{formatDate(sensor.lastSeen)}</p></div><div><p className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-400 sm:hidden">Readings today</p><p className="font-mono text-sm font-medium text-slate-700">{sensor.readingsToday.toLocaleString()}</p></div><div><StatusPill status={sensor.status} /></div></div>;
}

function Telemetry() {
  const query = useListTelemetry({ limit: 50 });
  const sensorsQuery = useListSensors();
  const ingest = useIngestTelemetry();
  const validate = useValidateTelemetry();
  const client = useQueryClient();
  const [form, setForm] = useState({ sensorId: '', metric: 'temperature', value: '', unit: '°C', recordedAt: '' });
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [notice, setNotice] = useState('');
  const readings = query.data ?? [];
  const sensors = sensorsQuery.data ?? [];
  const payload = (): TelemetryInput => ({ sensorId: form.sensorId, metric: form.metric, value: Number(form.value), unit: form.unit, ...(form.recordedAt ? { recordedAt: new Date(form.recordedAt).toISOString() } : {}) });
  const runValidate = (event: React.FormEvent) => { event.preventDefault(); setNotice(''); validate.mutate({ data: payload() }, { onSuccess: (response) => setResult(response), onError: () => setNotice('Validation could not be completed. Check the gateway connection.') }); };
  const runIngest = () => { setNotice(''); ingest.mutate({ data: payload() }, { onSuccess: (response) => { setResult(response.validation); setNotice(response.accepted ? 'Reading accepted and stored.' : 'Reading was rejected by the gateway.'); client.invalidateQueries({ queryKey: getListTelemetryQueryKey({ limit: 50 }) }); client.invalidateQueries({ queryKey: getGetGatewaySummaryQueryKey() }); client.invalidateQueries({ queryKey: getListActivityQueryKey() }); }, onError: () => setNotice('Ingest failed. The reading was not stored.') }); };
  return <><PageHeader eyebrow="Data stream" title="Telemetry" detail="Inspect the latest readings, then validate a payload before it enters the research record." action={<button type="button" onClick={() => query.refetch()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-teal-300 hover:text-teal-700" data-testid="button-refresh-telemetry"><RefreshCw size={15} />Refresh readings</button>} />
    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <section className="order-2 rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(33,59,71,.045)] xl:order-1"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-slate-400">Recent readings</p><div className="mt-1 flex items-center justify-between"><h2 className="text-lg font-extrabold tracking-[-.03em] text-slate-900">Ingest feed</h2><span className="font-mono text-[10px] text-slate-400">LAST 50</span></div></div>{query.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-16" />)}</div> : query.isError ? <div className="p-5"><QueryError label="telemetry" onRetry={() => query.refetch()} /></div> : readings.length === 0 ? <div className="p-5"><EmptyState icon={Activity} title="No readings in the feed" detail="Validated sensor payloads will appear here once the mesh starts sending data." /></div> : <div className="divide-y divide-slate-100">{readings.map((reading) => <ReadingRow reading={reading} key={reading.id} />)}</div>}</section>
      <section className="order-1 rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(33,59,71,.045)] xl:order-2"><div className="border-b border-slate-100 px-5 py-4 sm:px-6"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-teal-700">Payload lab</p><h2 className="mt-1 text-lg font-extrabold tracking-[-.03em] text-slate-900">Validate a reading</h2><p className="mt-1 text-xs leading-5 text-slate-500">Run checks without storing, or send a clean payload into the feed.</p></div><form onSubmit={runValidate} className="p-5 sm:p-6" data-testid="form-validate-telemetry"><label className="block text-xs font-bold text-slate-700">Sensor<select required value={form.sensorId} onChange={(event) => setForm({ ...form, sensorId: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="select-telemetry-sensor"><option value="">Select a registered sensor</option>{sensors.map((sensor) => <option key={sensor.id} value={sensor.id}>{sensor.location} · {sensor.macAddress}</option>)}</select></label><div className="mt-4 grid grid-cols-[1fr_.75fr] gap-3"><label className="text-xs font-bold text-slate-700">Metric<input required value={form.metric} onChange={(event) => setForm({ ...form, metric: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="input-telemetry-metric" /></label><label className="text-xs font-bold text-slate-700">Unit<input required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="input-telemetry-unit" /></label></div><label className="mt-4 block text-xs font-bold text-slate-700">Value<input required type="number" step="any" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="e.g. 23.4" className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-mono text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="input-telemetry-value" /></label><label className="mt-4 block text-xs font-bold text-slate-700">Recorded at <span className="font-normal text-slate-400">(optional)</span><input type="datetime-local" value={form.recordedAt} onChange={(event) => setForm({ ...form, recordedAt: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="input-telemetry-recorded-at" /></label>{result && <ValidationCard result={result} />}{notice && <div className={`mt-4 rounded-xl border px-3.5 py-3 text-xs font-bold ${notice.includes('failed') || notice.includes('rejected') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-800'}`} data-testid="status-telemetry">{notice}</div>}<div className="mt-5 grid grid-cols-2 gap-3"><button type="submit" disabled={validate.isPending || ingest.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3 text-xs font-bold text-teal-800 transition hover:bg-teal-100 disabled:opacity-50" data-testid="button-validate-telemetry"><ShieldCheck size={15} />{validate.isPending ? 'Checking…' : 'Validate only'}</button><button type="button" onClick={runIngest} disabled={validate.isPending || ingest.isPending || !form.sensorId || !form.value} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1c8f84] px-3 py-3 text-xs font-bold text-white transition hover:bg-[#15796f] disabled:opacity-50" data-testid="button-ingest-telemetry"><UploadCloud size={15} />{ingest.isPending ? 'Sending…' : 'Validate + ingest'}</button></div></form></section>
    </div>
  </>;
}

function ReadingRow({ reading }: { reading: TelemetryReading }) {
  return <div className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50/70 sm:px-6" data-testid={`row-telemetry-${reading.id}`}><div className="flex min-w-0 items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${reading.quality === 'valid' ? 'bg-teal-50 text-teal-700' : reading.quality === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}><Activity size={16} /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{reading.sensorLabel}</p><p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{reading.metric} · {formatDate(reading.recordedAt)}</p></div></div><div className="flex items-center gap-3 text-right"><div><p className="font-mono text-sm font-medium text-slate-800">{reading.value} <span className="text-xs text-slate-400">{reading.unit}</span></p><p className="mt-0.5 text-[10px] text-slate-400">reading</p></div><StatusPill status={reading.quality} /></div></div>;
}

function ValidationCard({ result }: { result: ValidationResult }) {
  return <div className={`mt-5 rounded-xl border p-4 ${result.valid ? 'border-teal-200 bg-teal-50/70' : 'border-rose-200 bg-rose-50/70'}`} data-testid="validation-result"><div className="flex items-center gap-2 text-sm font-extrabold">{result.valid ? <Check className="text-teal-700" size={16} /> : <AlertTriangle className="text-rose-700" size={16} />}<span className={result.valid ? 'text-teal-800' : 'text-rose-800'}>{result.valid ? 'Payload is valid' : 'Payload needs attention'}</span></div>{result.errors.length > 0 && <ul className="mt-2 space-y-1 text-xs text-rose-700">{result.errors.map((error) => <li key={error}>• {error}</li>)}</ul>}{result.warnings.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-700">{result.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul>}</div>;
}

function Engagement() {
  const query = useGetEngagementStrategy();
  const update = useUpdateEngagementStrategy();
  const client = useQueryClient();
  const [form, setForm] = useState<EngagementStrategyInput | null>(null);
  const [message, setMessage] = useState('');
  const strategy = query.data;
  const activeForm = form ?? (strategy ? { name: strategy.name, description: strategy.description, enabled: strategy.enabled, trigger: strategy.trigger, delivery: strategy.delivery } : null);
  const save = (event: React.FormEvent) => { event.preventDefault(); if (!activeForm) return; update.mutate({ data: activeForm }, { onSuccess: (saved: EngagementStrategy) => { setForm({ name: saved.name, description: saved.description, enabled: saved.enabled, trigger: saved.trigger, delivery: saved.delivery }); setMessage('Engagement strategy saved.'); client.invalidateQueries({ queryKey: getGetEngagementStrategyQueryKey() }); }, onError: () => setMessage('The strategy could not be saved. Try again.') }); };
  if (query.isLoading) return <><PageHeader eyebrow="Research engagement" title="Engagement strategy" detail="Decide how the gateway should surface meaningful changes to your research team." /><div className="grid gap-6 lg:grid-cols-[1fr_.75fr]"><Skeleton className="h-[460px]" /><Skeleton className="h-[320px]" /></div></>;
  if (query.isError || !strategy || !activeForm) return <QueryError label="engagement strategy" onRetry={() => query.refetch()} />;
  return <><PageHeader eyebrow="Research engagement" title="Engagement strategy" detail="Decide how the gateway should surface meaningful changes to your research team." action={<div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${activeForm.enabled ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-500'}`} data-testid="status-engagement"><span className={`h-2 w-2 rounded-full ${activeForm.enabled ? 'bg-teal-500' : 'bg-slate-400'}`} />{activeForm.enabled ? 'Strategy active' : 'Strategy paused'}</div>} />
     <DailyCheckIn />
    {message && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm font-semibold ${message.includes('could not') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-teal-200 bg-teal-50 text-teal-800'}`} data-testid="status-engagement-save">{message}</div>}
    <div className="grid gap-6 lg:grid-cols-[1fr_.75fr]"><form onSubmit={save} className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_4px_20px_rgba(33,59,71,.045)] sm:p-7" data-testid="form-engagement"><div className="flex items-start justify-between border-b border-slate-100 pb-5"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-teal-700">Active configuration</p><h2 className="mt-1 text-lg font-extrabold tracking-[-.03em] text-slate-900">Research response rules</h2></div><label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">Enabled<input type="checkbox" checked={activeForm.enabled} onChange={(event) => setForm({ ...activeForm, enabled: event.target.checked })} className="h-4 w-4 accent-teal-600" data-testid="checkbox-engagement-enabled" /></label></div><label className="mt-6 block text-xs font-bold text-slate-700">Strategy name<input required value={activeForm.name} onChange={(event) => setForm({ ...activeForm, name: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="input-engagement-name" /></label><label className="mt-4 block text-xs font-bold text-slate-700">Description<textarea required rows={4} value={activeForm.description} onChange={(event) => setForm({ ...activeForm, description: event.target.value })} className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="textarea-engagement-description" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-700">Trigger<select value={activeForm.trigger} onChange={(event) => setForm({ ...activeForm, trigger: event.target.value as EngagementStrategyInput['trigger'] })} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="select-engagement-trigger"><option value="threshold">Threshold crossed</option><option value="disconnect">Sensor disconnects</option><option value="anomaly">Anomaly detected</option></select></label><label className="text-xs font-bold text-slate-700">Delivery<select value={activeForm.delivery} onChange={(event) => setForm({ ...activeForm, delivery: event.target.value as EngagementStrategyInput['delivery'] })} className="mt-2 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="select-engagement-delivery"><option value="dashboard">Dashboard</option><option value="email">Email</option><option value="webhook">Webhook</option></select></label></div><div className="mt-7 flex justify-end"><button type="submit" disabled={update.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#1c8f84] px-4 py-3 text-xs font-bold text-white shadow-[0_6px_16px_rgba(28,143,132,.2)] transition hover:bg-[#15796f] disabled:opacity-50" data-testid="button-save-engagement"><Save size={15} />{update.isPending ? 'Saving…' : 'Save strategy'}</button></div></form>
      <div className="space-y-6"><section className="grid-paper rounded-2xl border border-slate-200/90 bg-[#f7fbfb] p-6 shadow-[0_4px_20px_rgba(33,59,71,.045)]"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d8f1ec] text-teal-700"><Send size={19} /></div><h2 className="mt-5 text-xl font-extrabold tracking-[-.035em] text-slate-900">What this strategy does</h2><p className="mt-2 text-sm leading-6 text-slate-500">When a <span className="font-bold text-slate-700">{activeForm.trigger}</span> signal is detected, Smart-X will route a concise event to the <span className="font-bold text-slate-700">{activeForm.delivery}</span> channel for your team to review.</p><div className="mt-6 flex items-center gap-3 rounded-xl border border-white bg-white/80 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white"><Cloud size={15} /></div><div><p className="text-xs font-bold text-slate-800">Gateway signal</p><p className="font-mono text-[10px] text-slate-400">→ engagement channel</p></div></div></section><section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_4px_20px_rgba(33,59,71,.045)]"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-slate-400">Change history</p><h2 className="mt-1 text-base font-extrabold text-slate-900">Last updated</h2></div><Timer size={18} className="text-slate-400" /></div><p className="mt-5 font-mono text-2xl font-medium tracking-[-.04em] text-slate-800">{formatDate(strategy.updatedAt)}</p><p className="mt-2 text-xs leading-5 text-slate-500">Changes apply to new gateway events after this point. Existing alerts are not replayed.</p></section></div></div>
  </>;
}

function Home() {
  return <div className="animate-rise">
    <section className="relative overflow-hidden rounded-[28px] bg-[#17323d] px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14">
      <div className="absolute -right-16 -top-24 h-80 w-80 rounded-full border border-[#49cdb9]/20" /><div className="absolute -right-4 -top-12 h-56 w-56 rounded-full border border-[#49cdb9]/20" />
      <div className="relative max-w-3xl"><p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#56d4c0]">South African field operations · Smart-X gateway</p><h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.04] tracking-[-.055em] sm:text-6xl">Field signals.<br /><span className="text-[#75d8c9]">Human decisions.</span></h1><p className="mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">One operational workspace for sensor health, validated telemetry and accountable device control. Suggestions are evidence-led; people decide what gets queued.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#54d0bd] px-5 py-3 text-sm font-extrabold text-[#15323a] transition hover:bg-[#78dfce]" data-testid="link-home-dashboard">Open operations dashboard <ArrowRight size={16} /></Link><Link href="/about" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10" data-testid="link-home-about">About the project</Link></div>
      </div>
      <div className="relative mt-12 grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3"><div className="bg-[#1b3a45]/90 p-4"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">Observe</p><p className="mt-2 text-sm font-bold">Sensors &amp; telemetry</p></div><div className="bg-[#1b3a45]/90 p-4"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">Review</p><p className="mt-2 text-sm font-bold">Evidence-backed suggestions</p></div><div className="bg-[#1b3a45]/90 p-4"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-400">Act</p><p className="mt-2 text-sm font-bold">Operator-approved commands</p></div></div>
    </section>
    <section className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.17em] text-teal-700">Built for the field</p><h2 className="mt-3 max-w-lg text-2xl font-extrabold leading-tight tracking-[-.04em] text-slate-900">A reliable hand-off from signal to response.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">Smart-X connects gateway data to practical operations. Teams can register sensors, validate before ingest, tune engagement rules, and review every device command in one place.</p><Link href="/dashboard" className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold text-teal-800 hover:text-teal-950" data-testid="link-home-open-ops">Go to central overview <ArrowRight size={15} /></Link></div>
      <div className="grid-paper rounded-2xl border border-slate-200 bg-[#f7fbfa] p-6 sm:p-8"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8f1ec] text-teal-800"><ShieldCheck size={19} /></div><p className="font-extrabold text-slate-900">Operator stays in control</p></div><p className="mt-4 text-sm leading-6 text-slate-600">Predictive recommendations are never executed automatically. Inspect the evidence, then explicitly apply to queue a command or dismiss the suggestion.</p><div className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-4 font-mono text-[10px] uppercase tracking-wider text-slate-500"><span className="h-2 w-2 rounded-full bg-[#1c9b8c]" />Human approval required</div></div>
    </section>
  </div>;
}

function About() {
  return <><PageHeader eyebrow="Project context" title="About Smart-X" detail="An applied IoT operations system for South African field teams." action={<Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-[#1c8f84] px-4 py-3 text-xs font-extrabold text-white" data-testid="link-about-dashboard">Open dashboard <ArrowRight size={15} /></Link>} />
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.17em] text-teal-700">Purpose</p><h2 className="mt-3 text-2xl font-extrabold tracking-[-.04em] text-slate-900">Make remote infrastructure legible and accountable.</h2><p className="mt-4 text-sm leading-7 text-slate-600">Smart-X brings field sensor registration, telemetry validation, engagement configuration and device command operations into a single gateway workspace. It is designed to help teams see what the system knows, understand why a response is proposed, and record what an operator chose to do.</p><p className="mt-3 text-sm leading-7 text-slate-600">This applied project focuses on practical oversight for connected infrastructure in South Africa: resilient monitoring, clear status, and safe, deliberate control from the dashboard.</p></section><section className="rounded-2xl border border-slate-200 bg-[#e7f2f0] p-6 sm:p-8"><p className="font-mono text-[10px] uppercase tracking-[.17em] text-teal-800">Current scope</p><ul className="mt-5 space-y-4">{[['Observe', 'Gateway health, sensor inventory, latest readings and activity.'], ['Validate', 'Check telemetry payloads before storing accepted readings.'], ['Respond', 'Queue pump and relay commands with standard or critical priority.'], ['Govern', 'Review recommendations and make an explicit apply or dismiss decision.']].map(([title, text]) => <li className="flex gap-3" key={title}><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-teal-800"><Check size={12} /></span><span><strong className="text-sm text-slate-900">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-600">{text}</span></span></li>)}</ul><div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-extrabold text-amber-900">Not yet in scope</p><p className="mt-1 text-xs leading-5 text-amber-800">PoE network topology mapping is future work and is intentionally disabled.</p></div></section></div>
  </>;
}

const commandActionLabel = (action: string) => ({
  pump_start: 'Start pump', pump_stop: 'Stop pump', relay_on: 'Relay on', relay_off: 'Relay off', relay_toggle: 'Toggle relay',
}[action] ?? action.replaceAll('_', ' '));

function DailyCheckIn() {
  const query = useGetEngagementCheckInStatus({ query: { queryKey: getGetEngagementCheckInStatusQueryKey() } });
  const checkIn = useCreateEngagementCheckIn();
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const status = query.data;
  const complete = () => {
    setMessage('');
    checkIn.mutate({ data: {} }, {
      onSuccess: (updated) => {
        client.setQueryData(getGetEngagementCheckInStatusQueryKey(), updated);
        client.invalidateQueries({ queryKey: getGetEngagementCheckInStatusQueryKey() });
        client.invalidateQueries({ queryKey: getListActivityQueryKey() });
        setMessage('Daily review recorded. Your progress is up to date.');
      },
      onError: () => {
        setMessage("Today's check-in could not be confirmed. Refreshing status to prevent a duplicate.");
        query.refetch();
      },
    });
  };
  return <section className="mt-6 overflow-hidden rounded-2xl border border-[#c9e3df] bg-[#eef8f6] shadow-[0_4px_20px_rgba(33,59,71,.035)]" data-testid="daily-operator-checkin">
    <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-teal-800 shadow-sm"><CalendarCheck size={20} /></div><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-teal-800">Daily operator rhythm</p><h2 className="mt-1 text-lg font-extrabold tracking-[-.03em] text-slate-900">Start today’s review</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">A brief daily check-in keeps the operating record current and builds a useful continuity habit across shifts.</p>
        {query.isLoading ? <div className="mt-3 flex gap-2"><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-28" /><Skeleton className="h-6 w-28" /></div> : query.isError || !status ? <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-rose-700"><span>Check-in progress is unavailable.</span><button type="button" onClick={() => query.refetch()} className="underline underline-offset-2" data-testid="button-retry-checkin">Retry</button></div> : <div className="mt-3 flex flex-wrap gap-2" data-testid="checkin-progress"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status.todayComplete ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>{status.todayComplete ? 'Today complete' : 'Today still open'}</span><span className="rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-medium text-slate-600">{status.completedThisWeek} / 7 this week</span><span className="rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-medium text-slate-600">{status.consecutiveDays} day streak</span>{status.lastCheckedInAt && <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[10px] font-medium text-slate-500">Last review {formatDate(status.lastCheckedInAt)}</span>}</div>}
        {message && <p className={`mt-2 text-xs font-semibold ${message.includes('could not') ? 'text-amber-800' : 'text-teal-800'}`} role="status" data-testid="status-checkin">{message}</p>}
      </div></div>
      <button type="button" onClick={complete} disabled={query.isLoading || query.isError || !status || status.todayComplete || checkIn.isPending} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-extrabold transition ${status?.todayComplete ? 'cursor-default border border-teal-200 bg-white text-teal-800' : 'bg-[#1c8f84] text-white hover:bg-[#15796f]'} disabled:opacity-70`} data-testid="button-complete-checkin">{status?.todayComplete ? <><Check size={15} />Completed today</> : <><CalendarCheck size={15} />{checkIn.isPending ? 'Recording review…' : 'Complete today’s check-in'}</>}</button>
    </div>
  </section>;
}

function RecommendationPanel() {
  const query = useListRecommendations({ query: { queryKey: getListRecommendationsQueryKey() } });
  const searchQuery = useListSearchEvents({ limit: 5 }, { query: { queryKey: getListSearchEventsQueryKey({ limit: 5 }) } });
  const resolve = useResolveRecommendation();
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const suggestions = (query.data ?? []).filter((item) => item.status === 'suggested');
  const decide = (recommendation: Recommendation, decision: 'apply' | 'dismiss') => {
    setMessage('');
    resolve.mutate({ recommendationId: recommendation.id, data: { decision } }, {
      onSuccess: (result) => {
        setMessage(decision === 'apply' ? `Suggestion applied. Command ${result.command?.id ?? ''} was queued for operator-reviewed execution.` : 'Suggestion dismissed and recorded.');
        client.invalidateQueries({ queryKey: getListRecommendationsQueryKey() });
        client.invalidateQueries({ queryKey: getListCommandsQueryKey() });
        client.invalidateQueries({ queryKey: getListCommandHistoryQueryKey() });
      },
      onError: () => setMessage('The decision could not be recorded. Retry when the gateway is available.'),
    });
  };
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(33,59,71,.045)] sm:p-6" data-testid="recommendations-panel">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-teal-700">Decision support</p><h2 className="mt-1 text-lg font-extrabold tracking-[-.03em] text-slate-900">Predictive suggestions</h2><p className="mt-1 text-xs text-slate-500">Recommendations are advisory only. Nothing runs until an operator applies it.</p></div><span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800">Human approval required</span></div>
    {message && <p className={`mt-4 rounded-lg px-3 py-2 text-xs font-semibold ${message.includes('could not') ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-800'}`} role="status">{message}</p>}
    {query.isLoading ? <div className="mt-5 grid gap-3 md:grid-cols-2">{[1, 2].map((item) => <Skeleton key={item} className="h-40" />)}</div> : query.isError ? <div className="mt-5"><QueryError label="recommendations" onRetry={() => query.refetch()} /></div> : suggestions.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center"><p className="text-sm font-bold text-slate-700">No pending suggestions</p><p className="mt-1 text-xs text-slate-500">New evidence-backed recommendations will appear here for review.</p></div> : <div className="mt-5 grid gap-3 lg:grid-cols-2">{suggestions.map((recommendation) => <article key={recommendation.id} className="rounded-xl border border-slate-200 bg-[#fbfdfd] p-4" data-testid={`recommendation-${recommendation.id}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-extrabold text-slate-900">{recommendation.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{recommendation.deviceLabel}</p></div><span className={`rounded-md px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${recommendation.severity === 'high' ? 'bg-rose-100 text-rose-800' : recommendation.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{recommendation.severity} severity</span></div><p className="mt-3 text-xs leading-5 text-slate-600">{recommendation.rationale}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 font-mono text-[10px] text-slate-500"><span>Confidence <strong className="text-slate-800">{Math.round(recommendation.confidence * 100)}%</strong></span><span>Proposed <strong className="text-slate-800">{commandActionLabel(recommendation.suggestedAction)}</strong></span></div><div className="mt-4 flex gap-2"><button type="button" disabled={resolve.isPending} onClick={() => decide(recommendation, 'apply')} className="inline-flex items-center gap-2 rounded-lg bg-[#1c8f84] px-3 py-2 text-xs font-extrabold text-white transition hover:bg-[#15796f] disabled:opacity-50" data-testid={`button-apply-${recommendation.id}`}><Check size={14} />{resolve.isPending ? 'Saving decision…' : 'Apply & queue'}</button><button type="button" disabled={resolve.isPending} onClick={() => decide(recommendation, 'dismiss')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" data-testid={`button-dismiss-${recommendation.id}`}><X size={14} />Dismiss</button></div></article>)}</div>}
    <div className="mt-5 border-t border-slate-100 pt-4"><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-500">Operator search signals</p><p className="mt-1 text-xs text-slate-500">Recent submitted lookups add behavioral context; typing alone is not recorded.</p></div>{searchQuery.isError && <button type="button" onClick={() => searchQuery.refetch()} className="text-xs font-bold text-teal-800" data-testid="button-retry-search-evidence">Retry</button>}</div>
      {searchQuery.isLoading ? <div className="mt-3 flex gap-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-8 w-40" /></div> : searchQuery.isError ? <p className="mt-3 text-xs text-rose-700">Recent search history could not be loaded.</p> : (searchQuery.data ?? []).length === 0 ? <p className="mt-3 text-xs text-slate-500">No submitted searches recorded yet.</p> : <div className="mt-3 flex flex-wrap gap-2">{(searchQuery.data ?? []).slice(0, 5).map((event) => <span key={event.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600" data-testid={`search-evidence-${event.id}`}><Search size={11} /><span className="max-w-[160px] truncate font-semibold">{event.query}</span>{event.deviceId && <span className="font-mono text-teal-800">device linked</span>}<time className="font-mono text-slate-400">{formatTime(event.occurredAt)}</time></span>)}</div>}
    </div>
  </section>;
}

function Commands() {
  const client = useQueryClient();
  const devicesQuery = useListDevices({ query: { queryKey: getListDevicesQueryKey() } });
  const commandsQuery = useListCommands(undefined, { query: { queryKey: getListCommandsQueryKey(), refetchInterval: 1500 } });
  const create = useCreateCommand();
  const createSearchEvent = useCreateSearchEvent();
  const [deviceId, setDeviceId] = useState('');
  const [action, setAction] = useState<DeviceCommandAction>('pump_start');
  const [priority, setPriority] = useState<'standard' | 'critical'>('standard');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [message, setMessage] = useState('');
  const [searchNotice, setSearchNotice] = useState('');
  const devices = devicesQuery.data ?? [];
  const commands = commandsQuery.data ?? [];
  const filtered = commands.filter((command) => {
    const matchesSearch = `${command.deviceLabel} ${command.action} ${command.id}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === 'all' || command.status === statusFilter) && (actionFilter === 'all' || command.action === actionFilter);
  });
  const selected = devices.find((device) => device.id === deviceId);
  const availableActions = selected?.type === 'smart_relay'
    ? ['relay_on', 'relay_off', 'relay_toggle'] as DeviceCommandAction[]
    : selected?.type === 'water_pump' ? ['pump_start', 'pump_stop'] as DeviceCommandAction[]
      : ['pump_start', 'pump_stop', 'relay_on', 'relay_off', 'relay_toggle'] as DeviceCommandAction[];
  const queue = (event: React.FormEvent) => {
    event.preventDefault();
    if (!deviceId) return;
    setMessage('');
    const data: DeviceCommandInput = { deviceId, action, priority, idempotencyKey: `sx-${deviceId}-${action}-${Date.now()}` };
    create.mutate({ data }, {
      onSuccess: (command) => {
        setMessage(`Command ${command.id} queued. The live stream will reflect gateway progress.`);
        client.invalidateQueries({ queryKey: getListCommandsQueryKey() });
        client.invalidateQueries({ queryKey: getListCommandHistoryQueryKey() });
      },
      onError: () => setMessage('Command was not queued. Check device connectivity and retry.'),
    });
  };
  const recordSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const submittedQuery = search.trim();
    setSearchNotice('');
    if (submittedQuery.length < 2) {
      setSearchNotice('Enter at least two characters, then submit to record this search.');
      return;
    }
    const normalized = submittedQuery.toLowerCase();
    const identifiedDevices = devices.filter((device) => [device.name, device.id, device.macAddress ?? ''].some((field) => field.toLowerCase().includes(normalized)));
    const identifiedDevice = identifiedDevices.length === 1 ? identifiedDevices[0] : undefined;
    createSearchEvent.mutate({ data: { query: submittedQuery, ...(identifiedDevice ? { deviceId: identifiedDevice.id } : {}) } }, {
      onSuccess: () => {
        setSearchNotice(identifiedDevice ? `Search recorded and linked to ${identifiedDevice.name}.` : 'Search recorded. No single matching device was identified.');
        client.invalidateQueries({ queryKey: getListSearchEventsQueryKey({ limit: 5 }) });
      },
      onError: () => setSearchNotice('Search history could not be saved. The command list remains available.'),
    });
  };
  return <><PageHeader eyebrow="Human-controlled operations" title="Command stream" detail="Queue explicit pump and relay actions, then follow their live gateway status. Suggestions never execute without an operator decision." action={<Link href="/command-history" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-teal-300 hover:text-teal-800" data-testid="link-command-history">Completed history <History size={15} /></Link>} />
    <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(33,59,71,.045)] sm:p-6"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-teal-700">New command</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Queue a device action</h2><p className="mt-2 text-xs leading-5 text-slate-500">Queueing records intent. Device execution and result are reported by the gateway.</p>
        {devicesQuery.isLoading ? <div className="mt-5 space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : devicesQuery.isError ? <div className="mt-5"><QueryError label="devices" onRetry={() => devicesQuery.refetch()} /></div> : devices.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No command-capable devices are available.</div> : <form onSubmit={queue} className="mt-5 space-y-4" data-testid="form-create-command">
          <label className="block text-xs font-bold text-slate-700">Target device<select required value={deviceId} onChange={(event) => { setDeviceId(event.target.value); const device = devices.find((item) => item.id === event.target.value); setAction(device?.type === 'smart_relay' ? 'relay_on' : 'pump_start'); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="select-command-device"><option value="">Select device</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.type.replaceAll('_', ' ')}</option>)}</select></label>
          <label className="block text-xs font-bold text-slate-700">Action<select value={action} onChange={(event) => setAction(event.target.value as DeviceCommandAction)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" data-testid="select-command-action">{availableActions.map((item) => <option key={item} value={item}>{commandActionLabel(item)}</option>)}</select></label>
          <fieldset><legend className="text-xs font-bold text-slate-700">Priority</legend><div className="mt-2 grid grid-cols-2 gap-2">{(['standard', 'critical'] as const).map((item) => <button key={item} type="button" onClick={() => setPriority(item)} className={`rounded-lg border px-3 py-2.5 text-xs font-bold capitalize ${priority === item ? item === 'critical' ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-500'}`} aria-pressed={priority === item} data-testid={`button-priority-${item}`}>{item}</button>)}</div></fieldset>
          {message && <p role="status" className={`rounded-lg px-3 py-2 text-xs font-semibold ${message.includes('not queued') ? 'bg-rose-50 text-rose-700' : 'bg-teal-50 text-teal-800'}`} data-testid="status-command-create">{message}</p>}
          <button type="submit" disabled={create.isPending || !deviceId} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1c8f84] px-4 py-3 text-sm font-extrabold text-white hover:bg-[#15796f] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-queue-command"><Send size={15} />{create.isPending ? 'Queueing…' : 'Queue command'}</button>
        </form>}
      </section>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(33,59,71,.045)]"><div className="border-b border-slate-100 px-5 py-5 sm:px-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-teal-700">Live queue · refreshes every 1.5 seconds</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Gateway command status</h2></div><button type="button" onClick={() => commandsQuery.refetch()} className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50" data-testid="button-refresh-commands"><RefreshCw size={14} />Refresh</button></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_150px_150px]"><form onSubmit={recordSearch} className="flex min-w-0 gap-2" data-testid="form-command-search"><label className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search device or command ID" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-teal-500" aria-label="Search commands" data-testid="input-command-search" /></label><button type="submit" disabled={createSearchEvent.isPending} className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5 text-[10px] font-extrabold text-teal-800 hover:bg-teal-100 disabled:opacity-60" data-testid="button-submit-command-search">{createSearchEvent.isPending ? 'Saving…' : 'Search'}</button></form><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-teal-500" aria-label="Filter command status" data-testid="filter-command-status"><option value="all">All statuses</option><option value="queued">Queued</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="failed">Failed</option></select><select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs outline-none focus:border-teal-500" aria-label="Filter command action" data-testid="filter-command-action"><option value="all">All actions</option><option value="pump_start">Start pump</option><option value="pump_stop">Stop pump</option><option value="relay_on">Relay on</option><option value="relay_off">Relay off</option><option value="relay_toggle">Toggle relay</option></select></div>
          {searchNotice && <p className={`mt-2 text-[11px] font-semibold ${searchNotice.includes('could not') || searchNotice.includes('Enter at') ? 'text-amber-800' : 'text-teal-800'}`} role="status" data-testid="status-search-record">{searchNotice}</p>}</div>
        {commandsQuery.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20" />)}</div> : commandsQuery.isError ? <div className="p-5"><QueryError label="command stream" onRetry={() => commandsQuery.refetch()} /></div> : filtered.length === 0 ? <div className="p-5"><EmptyState icon={Send} title={commands.length ? 'No commands match these filters' : 'No commands queued'} detail={commands.length ? 'Adjust the search or filters to see another command.' : 'Commands queued by operators will appear here as the gateway reports progress.'} /></div> : <div className="divide-y divide-slate-100">{filtered.map((command) => <CommandRow key={command.id} command={command} />)}</div>}
      </section>
    </div>
    <RecommendationPanel />
  </>;
}

function CommandRow({ command }: { command: DeviceCommand }) {
  return <div className="grid gap-3 px-5 py-4 sm:grid-cols-[1.2fr_.9fr_.8fr_auto] sm:items-center sm:px-6" data-testid={`row-command-${command.id}`}><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-800">{command.deviceLabel}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-400">{command.id} · {formatDate(command.queuedAt)}</p></div><div><p className="text-xs font-bold text-slate-700">{commandActionLabel(command.action)}</p><p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${command.priority === 'critical' ? 'text-rose-700' : 'text-slate-400'}`}>{command.priority} priority</p></div><div className="text-xs text-slate-500"><span className="sm:hidden">Status: </span><span>{command.startedAt ? `Started ${formatTime(command.startedAt)}` : 'Awaiting gateway'}</span></div><StatusPill status={command.status} /></div>;
}

function CommandHistory() {
  const query = useListCommandHistory();
  const [search, setSearch] = useState('');
  const records = [...(query.data ?? [])].sort((a, b) => new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime()).filter((command) => `${command.deviceLabel} ${command.action} ${command.status} ${command.id} ${command.result ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageHeader eyebrow="Audit trail" title="Command history" detail="Completed device actions, newest first. Search by device, action, result or command identifier." action={<Link href="/commands" className="inline-flex items-center gap-2 rounded-xl bg-[#1c8f84] px-4 py-2.5 text-xs font-bold text-white" data-testid="link-history-live-stream">Open live stream <ArrowRight size={15} /></Link>} />
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(33,59,71,.045)]"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-teal-700">Recent first · LIFO</p><h2 className="mt-1 text-lg font-extrabold text-slate-900">Completed command records</h2></div><label className="relative w-full sm:max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search history" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs outline-none focus:border-teal-500" aria-label="Search command history" data-testid="input-history-search" /></label></div>
      {query.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-20" />)}</div> : query.isError ? <div className="p-5"><QueryError label="command history" onRetry={() => query.refetch()} /></div> : records.length === 0 ? <div className="p-5"><EmptyState icon={History} title={query.data?.length ? 'No history matches your search' : 'No completed commands yet'} detail={query.data?.length ? 'Try another device, action or command ID.' : 'Completed and failed commands will be retained here for operational review.'} /></div> : <div className="divide-y divide-slate-100">{records.map((command) => <div key={command.id} className="grid gap-3 px-5 py-5 sm:grid-cols-[1.1fr_.9fr_1fr_auto] sm:items-start sm:px-6" data-testid={`history-command-${command.id}`}><div><p className="text-sm font-extrabold text-slate-800">{command.deviceLabel}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{command.id}</p></div><div><p className="text-xs font-bold text-slate-700">{commandActionLabel(command.action)}</p><p className="mt-1 text-[10px] text-slate-500">{command.priority} priority · queued {formatDate(command.queuedAt)}</p></div><div><p className="text-xs font-semibold text-slate-700">{command.result || 'No result supplied by gateway'}</p><p className="mt-1 text-[10px] text-slate-400">Completed {formatDate(command.completedAt)}</p></div><StatusPill status={command.status} /></div>)}</div>}
    </section>
  </>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Shell><Switch><Route path="/" component={Home} /><Route path="/about" component={About} /><Route path="/dashboard" component={Overview} /><Route path="/commands" component={Commands} /><Route path="/command-history" component={CommandHistory} /><Route path="/sensors" component={Sensors} /><Route path="/telemetry" component={Telemetry} /><Route path="/engagement" component={Engagement} /><Route component={NotFound} /></Switch></Shell></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;