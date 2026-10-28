import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  CirclePlus,
  Clock3,
  Eye,
  EyeOff,
  Filter,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Target,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Profile = { id: string; email: string; full_name: string; role: string; is_active: boolean };
type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: 'Meta Ads' | 'Referral' | 'Phone Call' | 'Other';
  service: string;
  assigned_to: string | null;
  status: 'new' | 'contacted' | 'follow_up' | 'converted' | 'lost';
  follow_up_date: string | null;
  notes: string;
  received_at: string;
  created_at: string;
  updated_at: string;
};

type Page = 'dashboard' | 'leads' | 'clients' | 'finance' | 'team' | 'settings';
type LeadForm = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'received_at'>;

const emptyForm: LeadForm = { name: '', phone: '', email: '', source: 'Other', service: '', assigned_to: null, status: 'new', follow_up_date: null, notes: '' };
const statuses: Lead['status'][] = ['new', 'contacted', 'follow_up', 'converted', 'lost'];
const sources = ['All sources', 'Meta Ads', 'Referral', 'Phone Call', 'Other'] as const;
const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Target },
  { id: 'clients', label: 'Clients', icon: UsersRound },
  { id: 'finance', label: 'Finance', icon: Tag },
  { id: 'team', label: 'Team', icon: UserRound },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function friendlyError() { return 'Something went wrong. Please try again.'; }
function statusLabel(status: Lead['status']) { return status === 'follow_up' ? 'Follow-up' : status.charAt(0).toUpperCase() + status.slice(1); }
function formatReceived(value: string) { return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(value)); }

function App() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setAuthLoading(false); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    supabase.from('profiles').select('id, email, full_name, role, is_active').eq('id', session.user.id).maybeSingle().then(({ data, error }) => {
      if (error || !data || !data.is_active) setAuthError('This account does not have workspace access. Contact your administrator.');
      else setProfile(data as Profile);
    });
  }, [session]);

  if (authLoading) return <div className="loading-screen"><div className="loading-mark">T</div><span>Loading workspace</span></div>;
  if (!session || !profile) return <Login error={authError} onError={setAuthError} />;
  return <Workspace profile={profile} />;
}

function Login({ error, onError }: { error: string; onError: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); onError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) onError('The email or password is not correct. Please try again.');
    setLoading(false);
  };
  return <main className="login-page">
    <header className="login-header"><img src="/taha_logo.png" alt="Taha Media" /><span>Internal access</span></header>
    <div className="login-rule" />
    <section className="login-intro"><p className="eyebrow">Taha Media / 01</p><h1>Your workspace.<br /><em>Your access.</em></h1><span className="lime-line" /></section>
    <form className="login-form" onSubmit={submit}>
      <div className="form-heading"><span>Sign in</span><ShieldCheck size={18} /></div>
      <label>Email address<input type="email" placeholder="Enter your email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
      <div className="login-meta"><span>Secure internal workspace</span><button type="button" onClick={() => onError('Please contact your administrator to reset your password.')}>Forgot password? Contact admin</button></div>
      {error && <div className="auth-message"><CircleAlert size={16} />{error}</div>}
      <button className="lime-button login-button" disabled={loading}>{loading ? 'Checking access…' : <>Log in <ArrowUpRight size={18} /></>}</button>
    </form>
    <footer className="login-footer"><span>Taha Media</span><span>01 / Access</span></footer>
  </main>;
}

function Workspace({ profile }: { profile: Profile }) {
  const [page, setPage] = useState<Page>('dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const loadData = async () => {
    setLoading(true); setDataError('');
    const [leadResult, profileResult] = await Promise.all([
      supabase.from('leads').select('*').order('received_at', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name, role, is_active').eq('is_active', true).order('full_name'),
    ]);
    if (leadResult.error || profileResult.error) setDataError(friendlyError());
    else { setLeads((leadResult.data ?? []) as Lead[]); setProfiles((profileResult.data ?? []) as Profile[]); }
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const saveLead = async (form: LeadForm, id?: string) => {
    const payload = { ...form, email: form.email || null, service: form.service || 'Not specified' };
    const result = id ? await supabase.from('leads').update(payload).eq('id', id).select().maybeSingle() : await supabase.from('leads').insert(payload).select().maybeSingle();
    if (result.error || !result.data) throw new Error(friendlyError());
    await loadData(); setSelectedLead(result.data as Lead); setShowAdd(false);
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand-lockup"><img src="/taha_logo.png" alt="Taha Media" /><span>Internal workspace</span></div>
      <nav><p className="nav-label">Workspace</p>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setMobileNav(false); }}><Icon size={18} /><span>{label}</span>{id === 'leads' && leads.length > 0 && <b>{leads.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="user-chip"><div className="avatar">{profile.full_name.slice(0, 1).toUpperCase()}</div><div><strong>{profile.full_name}</strong><span>{profile.role.split('_').join(' ')}</span></div><ChevronDown size={16} /></div><button className="signout" onClick={signOut}><LogOut size={17} /> Sign out</button></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div className="breadcrumb"><span>Taha Media</span><i>/</i><strong>{navItems.find((item) => item.id === page)?.label}</strong></div><div className="topbar-actions"><span className="date-label"><CalendarDays size={16} /> {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span><button className="icon-button"><Bell size={18} /><i /></button><div className="top-avatar">{profile.full_name.slice(0, 1).toUpperCase()}</div></div></header>
      {page === 'dashboard' && <Dashboard leads={leads} profiles={profiles} onOpenLeads={() => setPage('leads')} onAdd={() => setShowAdd(true)} />}
      {page === 'leads' && <LeadsPage leads={leads} profiles={profiles} loading={loading} error={dataError} onRetry={loadData} onAdd={() => setShowAdd(true)} onSelect={setSelectedLead} />}
      {['clients', 'finance', 'team', 'settings'].includes(page) && <PlaceholderPage page={page} />}
    </main>
    {showAdd && <LeadModal profiles={profiles} onClose={() => setShowAdd(false)} onSave={(form) => saveLead(form)} />}
    {selectedLead && <LeadDetail lead={selectedLead} profiles={profiles} onClose={() => setSelectedLead(null)} onSave={(form) => saveLead(form, selectedLead.id)} />}
  </div>;
}

function Dashboard({ leads, profiles, onOpenLeads, onAdd }: { leads: Lead[]; profiles: Profile[]; onOpenLeads: () => void; onAdd: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const metrics = [
    { label: "Today's new leads", value: leads.filter((lead) => lead.received_at.slice(0, 10) === today).length, note: 'Received since midnight', icon: Sparkles },
    { label: 'Total active leads', value: leads.filter((lead) => !['converted', 'lost'].includes(lead.status)).length, note: 'Across every source', icon: Target },
    { label: 'Follow-ups due', value: leads.filter((lead) => lead.status === 'follow_up' || lead.follow_up_date === today).length, note: 'Needs your attention', icon: Clock3 },
    { label: 'Converted leads', value: leads.filter((lead) => lead.status === 'converted').length, note: `${leads.length ? Math.round((leads.filter((lead) => lead.status === 'converted').length / leads.length) * 100) : 0}% conversion rate`, icon: Check },
  ];
  const sources = ['Meta Ads', 'Referral', 'Phone Call', 'Other'].map((source) => ({ source, count: leads.filter((lead) => lead.source === source).length }));
  return <div className="page-content"><div className="page-title-row"><div><p className="eyebrow">Wednesday / Command centre</p><h1>Good morning, {profiles[0]?.full_name.split(' ')[0] || 'team'}.</h1><p className="subtitle">A clear view of what needs to move today.</p></div><button className="lime-button" onClick={onAdd}><CirclePlus size={18} /> Add new lead</button></div>
    <section className="metric-grid">{metrics.map(({ label, value, note, icon: Icon }, index) => <div className={`metric metric-${index}`} key={label}><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{note}</small></div>)}</section>
    <div className="dashboard-grid"><section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Live pulse</p><h2>Recent lead activity</h2></div><button className="text-button" onClick={onOpenLeads}>View all <ArrowUpRight size={15} /></button></div>{leads.length === 0 ? <EmptyState compact /> : <div className="activity-list">{leads.slice(0, 5).map((lead) => <div className="activity-row" key={lead.id}><div className={`status-dot ${lead.status}`} /><div className="activity-copy"><strong>{lead.name}</strong><span>{lead.service} <i>·</i> {lead.source}</span></div><div className="activity-time"><span className={`status-pill ${lead.status}`}>{statusLabel(lead.status)}</span><small>{formatReceived(lead.received_at)}</small></div></div>)}</div>}</section>
      <section className="panel sources-panel"><div className="panel-heading"><div><p className="eyebrow">Acquisition</p><h2>Lead sources</h2></div><SlidersHorizontal size={18} /></div><div className="source-list">{sources.map(({ source, count }) => <div className="source-row" key={source}><div><span className="source-mark" /> <strong>{source}</strong></div><span>{count.toString().padStart(2, '0')}</span></div>)}</div><div className="source-footer"><span>Meta Ads is ready as a source</span><span className="prepared">Prepared <Check size={13} /></span></div></section></div>
    <section className="lower-strip"><div><p className="eyebrow">Next move</p><h2>Keep every conversation moving forward.</h2></div><button className="outline-button" onClick={onOpenLeads}>Open lead management <ArrowUpRight size={16} /></button></section>
  </div>;
}

function LeadsPage({ leads, profiles, loading, error, onRetry, onAdd, onSelect }: { leads: Lead[]; profiles: Profile[]; loading: boolean; error: string; onRetry: () => void; onAdd: () => void; onSelect: (lead: Lead) => void }) {
  const [query, setQuery] = useState(''); const [source, setSource] = useState('All sources'); const [status, setStatus] = useState('All statuses'); const [assignee, setAssignee] = useState('All owners');
  const filtered = useMemo(() => leads.filter((lead) => [lead.name, lead.phone, lead.email ?? '', lead.service].join(' ').toLowerCase().includes(query.toLowerCase()) && (source === 'All sources' || lead.source === source) && (status === 'All statuses' || lead.status === status) && (assignee === 'All owners' || lead.assigned_to === assignee)), [leads, query, source, status, assignee]);
  return <div className="page-content"><div className="page-title-row leads-title"><div><p className="eyebrow">Pipeline / {leads.length.toString().padStart(2, '0')} records</p><h1>Lead management</h1><p className="subtitle">Every opportunity, clearly accounted for.</p></div><button className="lime-button" onClick={onAdd}><CirclePlus size={18} /> Add new lead</button></div>
    <div className="filter-bar"><div className="search-box"><Search size={18} /><input placeholder="Search leads" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="filter-select"><Filter size={16} /><select value={source} onChange={(event) => setSource(event.target.value)}>{sources.map((item) => <option key={item}>{item}</option>)}</select></div><div className="filter-select"><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option>{statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></div><div className="filter-select owner-filter"><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option>All owners</option>{profiles.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></div></div>
    {error ? <div className="data-state"><CircleAlert size={22} /><h3>We couldn't load your leads</h3><p>Check your connection and try again.</p><button className="outline-button" onClick={onRetry}>Try again</button></div> : loading ? <div className="data-state"><div className="spinner" /><p>Loading your leads…</p></div> : filtered.length === 0 ? <EmptyState onAdd={onAdd} /> : <div className="lead-table-wrap"><table className="lead-table"><thead><tr><th>Lead</th><th>Source</th><th>Interest</th><th>Owner</th><th>Status</th><th>Received</th><th /></tr></thead><tbody>{filtered.map((lead) => <tr key={lead.id} onClick={() => onSelect(lead)}><td><div className="table-person"><div className="small-avatar">{lead.name.slice(0, 1).toUpperCase()}</div><div><strong>{lead.name}</strong><span>{lead.phone}</span></div></div></td><td><span className="source-tag"><i />{lead.source}</span></td><td>{lead.service}</td><td>{profiles.find((person) => person.id === lead.assigned_to)?.full_name || <span className="muted">Unassigned</span>}</td><td><span className={`status-pill ${lead.status}`}>{statusLabel(lead.status)}</span></td><td>{formatReceived(lead.received_at)}</td><td><button className="row-action" aria-label={`Open ${lead.name}`}><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div>}
  </div>;
}

function EmptyState({ compact = false, onAdd }: { compact?: boolean; onAdd?: () => void }) { return <div className={`empty-state ${compact ? 'compact' : ''}`}><div className="empty-icon"><Target size={22} /></div><h3>{compact ? 'No activity yet' : 'Your pipeline is clear'}</h3><p>{compact ? 'New lead activity will appear here.' : 'Add your first lead to start building momentum.'}</p>{!compact && onAdd && <button className="lime-button" onClick={onAdd}><CirclePlus size={17} /> Add a lead</button>}</div>; }

function LeadModal({ profiles, onClose, onSave }: { profiles: Profile[]; onClose: () => void; onSave: (form: LeadForm) => Promise<void> }) { return <LeadEditor title="Add a new lead" profiles={profiles} initial={emptyForm} onClose={onClose} onSave={onSave} />; }
function LeadDetail({ lead, profiles, onClose, onSave }: { lead: Lead; profiles: Profile[]; onClose: () => void; onSave: (form: LeadForm) => Promise<void> }) { const initial: LeadForm = { name: lead.name, phone: lead.phone, email: lead.email, source: lead.source, service: lead.service, assigned_to: lead.assigned_to, status: lead.status, follow_up_date: lead.follow_up_date, notes: lead.notes }; return <LeadEditor title="Lead details" profiles={profiles} initial={initial} onClose={onClose} onSave={onSave} detail />; }
function LeadEditor({ title, profiles, initial, onClose, onSave, detail = false }: { title: string; profiles: Profile[]; initial: LeadForm; onClose: () => void; onSave: (form: LeadForm) => Promise<void>; detail?: boolean }) {
  const [form, setForm] = useState<LeadForm>(initial); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const update = <K extends keyof LeadForm>(key: K, value: LeadForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { await onSave(form); } catch { setError(friendlyError()); } finally { setSaving(false); } };
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="lead-drawer"><div className="drawer-header"><div><p className="eyebrow">{detail ? 'Lead record' : 'New opportunity'}</p><h2>{title}</h2></div><button className="close-button" onClick={onClose}><X size={20} /></button></div><form className="lead-form" onSubmit={submit}><div className="form-grid"><label>Full name<input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Ahmed Khan" required /></label><label>Phone number<input value={form.phone} onChange={(event) => update('phone', event.target.value)} placeholder="+92 300 0000000" required /></label><label>Email address<input type="email" value={form.email ?? ''} onChange={(event) => update('email', event.target.value)} placeholder="Optional" /></label><label>Interested service<input value={form.service} onChange={(event) => update('service', event.target.value)} placeholder="e.g. Social media management" /></label><label>Lead source<select value={form.source} onChange={(event) => update('source', event.target.value as Lead['source'])}>{sources.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>Assigned salesperson<select value={form.assigned_to ?? ''} onChange={(event) => update('assigned_to', event.target.value || null)}><option value="">Unassigned</option>{profiles.map((person) => <option value={person.id} key={person.id}>{person.full_name}</option>)}</select></label><label>Lead status<select value={form.status} onChange={(event) => update('status', event.target.value as Lead['status'])}>{statuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></label><label>Follow-up date<input type="date" value={form.follow_up_date ?? ''} onChange={(event) => update('follow_up_date', event.target.value || null)} /></label></div><label className="notes-field">Internal notes<textarea rows={5} value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Add useful context for the team…" /></label>{error && <div className="auth-message"><CircleAlert size={16} />{error}</div>}<div className="drawer-footer"><button type="button" className="outline-button" onClick={onClose}>Cancel</button><button className="lime-button" disabled={saving}>{saving ? 'Saving…' : <>{detail ? 'Save changes' : 'Create lead'} <ArrowUpRight size={17} /></>}</button></div></form></section></div>;
}

function PlaceholderPage({ page }: { page: Page }) { const labels: Record<string, string> = { clients: 'Clients', finance: 'Finance', team: 'Team', settings: 'Settings' }; return <div className="page-content placeholder-page"><div className="placeholder-mark"><Sparkles size={24} /></div><p className="eyebrow">Phase 1 / Coming next</p><h1>{labels[page]}</h1><p className="subtitle">This space is reserved for the next layer of the Taha Media workspace.</p><span className="lime-line" /></div>; }

export default App;
