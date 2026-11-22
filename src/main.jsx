import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard, Files, Building2, History, LogOut, Search, UploadCloud,
  ShieldCheck, FileText, Clock3, AlertTriangle, CheckCircle2, CircleHelp,
  Plus, X, ChevronRight, Settings, LockKeyhole, Download, RefreshCw,
  FileCheck2, ArrowUpRight, Eye, CalendarDays, IndianRupee, Paperclip
} from 'lucide-react';
import './style.css';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = URL && KEY ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
const money = n => n == null || n === '' ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n));
const date = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not specified';
const dateTime = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not specified';
const verdictLabel = v => ({ eligible: 'Eligible', eligible_with_conditions: 'Eligible with conditions', not_eligible: 'Not eligible', insufficient_evidence: 'Insufficient evidence' }[v] || 'Not assessed');
const verdictClass = v => v === 'eligible' ? 'green' : v === 'not_eligible' ? 'red' : 'amber';
const fileAccept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';

function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setErr(error.message); setBusy(false); return; }
    const { data: admin, error: adminError } = await supabase.from('admin_profiles').select('user_id,is_active,display_name,email').eq('user_id', data.user.id).eq('is_active', true).maybeSingle();
    if (adminError || !admin) { await supabase.auth.signOut(); setErr('This account is not authorised for the Synergy administrator portal.'); setBusy(false); return; }
    onLogin(data.user, admin); setBusy(false);
  }
  return <div className="login-wrap"><div className="login-card"><div className="brand-mark">S</div><div className="eyebrow">SYNERGY GLOBAL PRIVATE LIMITED</div><h1>Tender Intelligence</h1><p className="muted">Secure administrator sign-in</p><form onSubmit={submit}><label>Administrator email</label><input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com" required/><label>Password</label><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required/><button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>{err && <div className="error">{err}</div>}</form><div className="secure-note"><LockKeyhole size={15}/> Administrator accounts only · Public registration disabled</div></div></div>;
}

function App() {
  const [user, setUser] = useState(null); const [admin, setAdmin] = useState(null); const [checking, setChecking] = useState(true);
  const [page, setPage] = useState('dashboard'); const [tenders, setTenders] = useState([]); const [profile, setProfile] = useState(null);
  const [financials, setFinancials] = useState([]); const [docs, setDocs] = useState([]); const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState(''); const [modal, setModal] = useState(false); const [toast, setToast] = useState('');
  const [selected, setSelected] = useState(null); const [tenderFiles, setTenderFiles] = useState([]); const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null); const [compliance, setCompliance] = useState([]); const [analysing, setAnalysing] = useState(false); const [reportUrl, setReportUrl] = useState('');

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await validateUser(data.session.user, alive);
      if (alive) setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUser(null); setAdmin(null); setSelected(null); }
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function validateUser(authUser, alive = true) {
    const { data: a, error } = await supabase.from('admin_profiles').select('user_id,is_active,display_name,email').eq('user_id', authUser.id).eq('is_active', true).maybeSingle();
    if (error || !a) { await supabase.auth.signOut(); if (alive) { setUser(null); setAdmin(null); } return; }
    if (alive) { setUser(authUser); setAdmin(a); }
  }

  async function load() {
    if (!user) return; setBusy(true);
    const [t, p, f, d] = await Promise.all([
      supabase.from('tenders').select('*').order('created_at', { ascending: false }),
      supabase.from('company_profile').select('*').eq('is_primary', true).maybeSingle(),
      supabase.from('company_financials').select('*').order('financial_year', { ascending: false }),
      supabase.from('evidence_documents').select('*').order('created_at', { ascending: false })
    ]);
    const failures = [t,p,f,d].filter(x => x.error);
    if (!t.error) setTenders(t.data || []); if (!p.error) setProfile(p.data); if (!f.error) setFinancials(f.data || []); if (!d.error) setDocs(d.data || []);
    if (failures.length) notify(`Some records could not be loaded: ${failures[0].error.message}`);
    setBusy(false);
  }
  useEffect(() => { load(); }, [user]);
  function notify(s) { setToast(s); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setToast(''), 4200); }
  async function logout() { await supabase.auth.signOut(); setUser(null); setAdmin(null); }

  async function uploadCompanyEvidence(fileList, category = 'Company evidence') {
    const files = Array.from(fileList || []); if (!files.length) return; setUploading(true);
    for (const file of files) {
      const path = `${user.id}/company/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upError } = await supabase.storage.from('synergy-tender-documents').upload(path, file, { upsert: false });
      if (upError) { notify(`Upload failed for ${file.name}: ${upError.message}`); continue; }
      const { error } = await supabase.from('evidence_documents').insert({ title: file.name, category, storage_path: path, original_filename: file.name, mime_type: file.type || null, uploaded_by: user.id });
      if (error) notify(`File stored but evidence record failed: ${error.message}`);
    }
    await load(); setUploading(false); notify('Company evidence upload finished. Verification remains pending until reviewed.');
  }

  async function openTender(t) {
    setSelected(t); setPage('tender-detail'); setAnalysis(null); setCompliance([]); setTenderFiles([]); setReportUrl('');
    const [files, a] = await Promise.all([
      supabase.from('tender_files').select('*').eq('tender_id', t.id).order('created_at', { ascending: true }),
      supabase.from('tender_analyses').select('*').eq('tender_id', t.id).order('version', { ascending: false }).limit(1).maybeSingle()
    ]);
    if (files.error) notify(files.error.message); else setTenderFiles(files.data || []);
    if (a.data) { setAnalysis(a.data); const { data: items, error } = await supabase.from('compliance_items').select('*').eq('analysis_id', a.data.id).order('created_at'); if (!error) setCompliance(items || []); }
  }

  async function uploadTenderFiles(fileList, tender = selected) {
    const files = Array.from(fileList || []); if (!files.length || !tender) return; setUploading(true);
    let succeeded = 0;
    for (const file of files) {
      const path = `${user.id}/tenders/${tender.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upError } = await supabase.storage.from('synergy-tender-documents').upload(path, file, { upsert: false });
      if (upError) { notify(`Upload failed for ${file.name}: ${upError.message}`); continue; }
      const type = classifyDocument(file.name);
      const { error } = await supabase.from('tender_files').insert({ tender_id: tender.id, document_type: type, original_filename: file.name, storage_path: path, mime_type: file.type || null, extraction_status: 'pending' });
      if (error) notify(`File stored but tender file record failed: ${error.message}`); else succeeded++;
    }
    const { data: filesNow } = await supabase.from('tender_files').select('*').eq('tender_id', tender.id).order('created_at');
    setTenderFiles(filesNow || []); setUploading(false); notify(`${succeeded} tender document(s) attached. Run AI assessment when the complete bid package is ready.`);
  }

  async function runAnalysis(tender = selected) {
    if (!tender) return; setAnalysing(true); notify('Extracting documents and assessing tender clauses…');
    const { data, error } = await supabase.functions.invoke('tender-analysis', { body: { action: 'analyze', tender_id: tender.id } });
    if (error || data?.error) { notify(data?.error || error.message || 'Analysis failed.'); setAnalysing(false); return; }
    setAnalysis({ id: data.analysis_id, verdict: data.verdict, executive_summary: data.executive_summary, financial_assessment: data.financial_assessment, report_storage_path: null });
    setCompliance(data.clauses || []); setReportUrl(data.report_url || '');
    const { data: refreshed } = await supabase.from('tenders').select('*').eq('id', tender.id).single();
    if (refreshed) { setSelected(refreshed); setTenders(prev => prev.map(t => t.id === refreshed.id ? refreshed : t)); }
    const { data: latestFiles } = await supabase.from('tender_files').select('*').eq('tender_id', tender.id).order('created_at');
    setTenderFiles(latestFiles || []); setAnalysing(false); notify('Tender assessment completed. Review every cited clause before submission.');
  }

  async function downloadPrivateFile(path, name) {
    const { data, error } = await supabase.storage.from('synergy-tender-documents').createSignedUrl(path, 60);
    if (error) { notify(error.message); return; }
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = name || 'document'; a.target = '_blank'; a.rel = 'noreferrer'; a.click();
  }

  async function createTender(form) {
    const payload = { ...form, created_by: user.id, bid_value_inr: form.bid_value_inr ? Number(form.bid_value_inr) : null, emd_inr: form.emd_inr ? Number(form.emd_inr) : null, submission_deadline: form.submission_deadline ? new Date(form.submission_deadline).toISOString() : null };
    const { data, error } = await supabase.from('tenders').insert(payload).select().single();
    if (error) { notify(error.message); return; }
    setModal(false); await load(); await openTender(data); notify('Tender created. Attach the complete bid package to continue.');
  }

  async function updateTender(patch) {
    if (!selected) return; const { data, error } = await supabase.from('tenders').update(patch).eq('id', selected.id).select().single();
    if (error) { notify(error.message); return; } setSelected(data); setTenders(prev => prev.map(t => t.id === data.id ? data : t)); notify('Tender record updated.');
  }

  if (!supabase) return <div className="setup"><h1>Environment setup required</h1><p>Copy <code>.env.example</code> to <code>.env</code>, then run <code>npm install</code> and <code>npm run dev</code>.</p></div>;
  if (checking) return <div className="loading">Loading secure portal…</div>;
  if (!user) return <Login onLogin={(u,a) => { setUser(u); setAdmin(a); }} />;

  const pending = tenders.filter(t => ['uploaded','analysing','analysis_ready','conditional_go'].includes(t.status));
  const qualified = tenders.filter(t => t.final_verdict === 'eligible').length;
  const filtered = tenders.filter(t => (t.title + ' ' + (t.tender_reference || '') + ' ' + (t.procuring_entity || '')).toLowerCase().includes(query.toLowerCase()));
  const avg = financials.length ? financials.reduce((s, f) => s + Number(f.turnover_inr || 0), 0) / financials.length : 0;
  const pageTitle = ({ dashboard:'Dashboard', tenders:'Tender analyser', company:'Company profile', history:'Tender history', 'tender-detail':'Tender workspace' })[page];

  return <div className="app"><aside className="sidebar"><div className="side-brand"><div className="brand-mark small">S</div><div><b>SYNERGY</b><small>TENDER INTELLIGENCE</small></div></div><div className="side-label">WORKSPACE</div>
    {[[LayoutDashboard,'dashboard','Overview'],[Files,'tenders','Tender analyser'],[Building2,'company','Company profile'],[History,'history','Tender history']].map(([Icon,id,label])=><button key={id} className={`nav ${page===id || (page==='tender-detail' && id==='tenders')?'active':''}`} onClick={()=>setPage(id)}><Icon size={18}/>{label}</button>)}
    <div className="side-bottom"><div className="admin-chip"><ShieldCheck size={17}/><div><b>{admin?.display_name || user.email}</b><small>Authorised administrator</small></div></div><button className="nav" onClick={logout}><LogOut size={18}/> Sign out</button></div></aside>
    <main className="main"><header className="topbar"><div><div className="eyebrow">SYNERGY GLOBAL / {pageTitle.toUpperCase()}</div><h2>{pageTitle}</h2></div><div className="top-actions"><span className="secure-pill"><LockKeyhole size={14}/> Private workspace</span><button className="icon-btn" onClick={page==='tender-detail' && selected ? ()=>openTender(selected) : load} title="Refresh"><RefreshCw size={17}/></button></div></header>
      {page==='dashboard' && <><div className="welcome"><div><h1>Good day, {admin?.display_name || 'Administrator'}</h1><p>Current tender qualification overview for Synergy Global.</p></div><button className="primary" onClick={()=>setPage('tenders')}><Plus size={17}/> Analyse new tender</button></div>
        <div className="stats"><Stat icon={Files} label="Total tenders" value={tenders.length}/><Stat icon={Clock3} label="Pending review" value={pending.length}/><Stat icon={CheckCircle2} label="Eligible" value={qualified}/><Stat icon={FileText} label="Evidence documents" value={docs.length}/></div>
        <div className="grid-two"><section className="panel"><div className="panel-head"><div><h3>Recent tenders</h3><p>Latest uploaded opportunities</p></div><button className="text-btn" onClick={()=>setPage('history')}>View history <ChevronRight size={15}/></button></div><TenderTable rows={tenders.slice(0,6)} onOpen={openTender}/></section>
          <section className="panel"><div className="panel-head"><div><h3>Company readiness</h3><p>Permanent bidder profile</p></div><button className="text-btn" onClick={()=>setPage('company')}>Open profile <ChevronRight size={15}/></button></div><div className="readiness"><div className="readiness-icon"><Building2/></div><div><b>{profile?.company_name || 'Synergy Global Private Limited'}</b><p>Turnover records loaded · verification pending</p></div></div>{financials.map(f=><div className="financial-line" key={f.id}><span>{f.financial_year}</span><b>{money(f.turnover_inr)}</b><em>{f.verification_status==='verified'?'Verified':'Proof pending'}</em></div>)}<div className="notice"><AlertTriangle size={17}/> Average of stored turnover figures: {money(avg)}. Upload audited statements and CA certificates before relying on these figures in a bid.</div></section></div>
      </>}
      {page==='tenders' && <><div className="page-intro"><div><h3>Start a tender assessment</h3><p>Create a tender record, then attach the main bid, ATC, BOQ, annexures and corrigenda.</p></div><button className="primary" onClick={()=>setModal(true)}><Plus size={17}/> Create tender</button></div>
        <section className="panel"><div className="upload-zone"><UploadCloud size={30}/><h3>Build a complete tender file</h3><p>Create a tender record first. You can then attach multiple documents in its workspace.</p><button className="primary" onClick={()=>setModal(true)}>Create tender record</button></div><div className="notice"><CircleHelp size={17}/> Secure uploads are connected. Automated OCR, clause extraction and AI eligibility analysis are not yet connected; uploads will be stored with extraction status “pending”.</div></section>
        <section className="panel"><div className="panel-head"><div><h3>All tenders</h3><p>Every assessment remains in tender history</p></div><div className="searchbox"><Search size={16}/><input placeholder="Search tender or reference" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><TenderTable rows={filtered} onOpen={openTender}/></section></>}
      {page==='company' && <><section className="panel"><div className="panel-head"><div><h3>Permanent bidder profile</h3><p>Reusable baseline for all future tender comparisons</p></div><span className="tag green">Fixed company profile</span></div><div className="profile-grid"><div><small>REGISTERED BIDDER NAME</small><b>{profile?.company_name || 'Synergy Global Private Limited'}</b></div><div><small>BUSINESS DOMAINS</small><b>{(profile?.business_domains || ['AV solutions','IT & technology']).join(' · ')}</b></div><div><small>PROFILE STATUS</small><b>Initial baseline – evidence completion pending</b></div></div><h4>Financial turnover records</h4><div className="table-wrap"><table><thead><tr><th>Financial year</th><th>Turnover</th><th>Evidence status</th></tr></thead><tbody>{financials.map(f=><tr key={f.id}><td>{f.financial_year}</td><td>{money(f.turnover_inr)}</td><td><span className={`tag ${f.verification_status==='verified'?'green':'amber'}`}>{f.verification_status.replaceAll('_',' ')}</span></td></tr>)}</tbody></table></div><div className="notice"><AlertTriangle size={17}/> Stored turnover values are user-provided, not independently verified. Do not treat them as audited proof until supporting documents are checked.</div></section>
        <section className="panel"><div className="panel-head"><div><h3>Company evidence repository</h3><p>Upload certificates once; reuse them in future bid assessments.</p></div><label className={`primary upload-btn ${uploading?'disabled':''}`}><UploadCloud size={16}/> {uploading?'Uploading…':'Upload evidence'}<input type="file" multiple accept={fileAccept} disabled={uploading} onChange={e=>uploadCompanyEvidence(e.target.files)}/></label></div><div className="evidence-list">{docs.length?docs.map(d=><div className="evidence-row" key={d.id}><FileText/><div><b>{d.title}</b><small>{d.category} · Uploaded {date(d.created_at)}</small></div><span className={`tag ${d.verification_status==='verified'?'green':'amber'}`}>{d.verification_status}</span><button className="icon-btn" title="Download" onClick={()=>downloadPrivateFile(d.storage_path,d.original_filename)}><Download size={16}/></button></div>):<div className="empty">No company evidence uploaded yet.</div>}</div></section></>}
      {page==='history' && <section className="panel"><div className="panel-head"><div><h3>Complete tender history</h3><p>Search, review and revisit previous qualification decisions.</p></div><div className="searchbox"><Search size={16}/><input placeholder="Search tender history" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><TenderTable rows={filtered} onOpen={openTender}/></section>}
      {page==='tender-detail' && selected && <TenderWorkspace tender={selected} files={tenderFiles} analysis={analysis} compliance={compliance} uploading={uploading} analysing={analysing} reportUrl={reportUrl} onAnalyze={()=>runAnalysis(selected)} onBack={()=>setPage('tenders')} onUpload={uploadTenderFiles} onDownload={downloadPrivateFile} onUpdate={updateTender}/ >}
      <footer>Synergy Global Private Limited · Confidential · Administrator access only</footer>
    </main>
    {modal && <CreateTender onClose={()=>setModal(false)} onCreate={createTender}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function classifyDocument(name) { const n=name.toLowerCase(); if(n.includes('atc') || n.includes('additional terms')) return 'Buyer ATC'; if(n.includes('boq') || n.includes('bill of quantity')) return 'BOQ'; if(n.includes('corrig')) return 'Corrigendum'; if(n.includes('annex')) return 'Annexure'; if(n.includes('spec') || n.includes('technical')) return 'Technical specification'; return 'Tender document'; }
function Stat({icon:Icon,label,value}) { return <div className="stat"><div className="stat-icon"><Icon size={19}/></div><div><small>{label}</small><strong>{value}</strong></div></div>; }
function TenderTable({rows,onOpen}) { if(!rows.length) return <div className="empty">No tenders found. Create a tender to begin.</div>; return <div className="table-wrap"><table><thead><tr><th>Tender / reference</th><th>Bid value</th><th>Deadline</th><th>Verdict</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(t=><tr key={t.id}><td><button className="table-link" onClick={()=>onOpen?.(t)}><b>{t.title}</b><small>{t.tender_reference||'Reference pending'}{t.procuring_entity?` · ${t.procuring_entity}`:''}</small></button></td><td>{money(t.bid_value_inr)}</td><td>{date(t.submission_deadline)}</td><td><span className={`tag ${verdictClass(t.final_verdict)}`}>{verdictLabel(t.final_verdict)}</span></td><td>{(t.status||'uploaded').replaceAll('_',' ')}</td><td><button className="icon-btn" onClick={()=>onOpen?.(t)} title="Open tender"><ChevronRight size={17}/></button></td></tr>)}</tbody></table></div>; }

function TenderWorkspace({tender,files,analysis,compliance,uploading,analysing,reportUrl,onAnalyze,onBack,onUpload,onDownload,onUpdate}) {
  const [fileType,setFileType]=useState('');
  return <div className="tender-workspace"><div className="workspace-back"><button className="text-btn" onClick={onBack}>‹ Back to tenders</button><span className="tag amber">{(tender.status||'uploaded').replaceAll('_',' ')}</span></div>
    <section className="panel"><div className="panel-head"><div><div className="eyebrow">{tender.tender_reference || 'REFERENCE PENDING'}</div><h3>{tender.title}</h3><p>{tender.procuring_entity || 'Procuring entity not entered'} · {tender.portal || 'Portal not specified'}</p></div><span className={`tag ${verdictClass(tender.final_verdict)}`}>{verdictLabel(tender.final_verdict)}</span></div>
      <div className="tender-facts"><div><small>ESTIMATED BID VALUE</small><b>{money(tender.bid_value_inr)}</b></div><div><small>EMD</small><b>{money(tender.emd_inr)}</b></div><div><small>SUBMISSION DEADLINE</small><b>{dateTime(tender.submission_deadline)}</b></div><div><small>DELIVERY LOCATION</small><b>{tender.delivery_location || 'Not specified'}</b></div></div>
      <div className="status-controls"><label>Workflow status<select value={tender.status||'uploaded'} onChange={e=>onUpdate({status:e.target.value})}>{['uploaded','analysing','analysis_ready','go','conditional_go','no_go','submitted','won','lost','withdrawn','closed'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label><label>Eligibility verdict<select value={tender.final_verdict||''} onChange={e=>onUpdate({final_verdict:e.target.value||null})}><option value="">Not assessed</option><option value="eligible">Eligible</option><option value="eligible_with_conditions">Eligible with conditions</option><option value="not_eligible">Not eligible</option><option value="insufficient_evidence">Insufficient evidence</option></select></label></div>
    </section>
    <section className="panel"><div className="panel-head"><div><h3>Bid document repository</h3><p>Attach the main bid PDF, buyer ATC, BOQ, annexures and corrigenda.</p></div><label className={`primary upload-btn ${uploading?'disabled':''}`}><UploadCloud size={16}/>{uploading?'Uploading…':'Attach documents'}<input type="file" multiple accept={fileAccept} disabled={uploading} onChange={e=>onUpload(e.target.files,tender)}/></label></div>
      <div className="file-checklist"><span><FileCheck2 size={15}/> Main tender</span><span><FileCheck2 size={15}/> Buyer ATC</span><span><FileCheck2 size={15}/> BOQ</span><span><FileCheck2 size={15}/> Annexures</span><span><FileCheck2 size={15}/> Corrigenda</span></div>
      {files.length ? <div className="evidence-list">{files.map(f=><div className="evidence-row" key={f.id}><FileText/><div><b>{f.original_filename}</b><small>{f.document_type} · {f.mime_type||'File'} · {date(f.created_at)}</small></div><span className={`tag ${f.extraction_status==='completed'?'green':'amber'}`}>{f.extraction_status}</span><button className="icon-btn" title="Download" onClick={()=>onDownload(f.storage_path,f.original_filename)}><Download size={16}/></button></div>)}</div> : <div className="empty">No tender files attached yet.</div>}
    </section>
    <section className="panel"><div className="panel-head"><div><h3>Analysis and compliance</h3><p>AI extraction, evidence matching, financial checks and clause-level findings.</p></div><div className="top-actions"><button className="primary" disabled={analysing || !files.length} onClick={onAnalyze}>{analysing?'Analysing…':analysis?'Re-run assessment':'Run AI assessment'}</button>{reportUrl && <a className="secondary report-download" href={reportUrl} target="_blank" rel="noreferrer" download="Synergy-Tender-Assessment.pdf">Download PDF report</a>}</div></div>
      {analysis ? <><div className="analysis-summary"><b>{verdictLabel(analysis.verdict)}</b><p>{analysis.executive_summary || 'No executive summary available.'}</p>{analysis.financial_assessment && <p><b>Financial assessment:</b> {analysis.financial_assessment.status} — {analysis.financial_assessment.explanation}</p>}</div><div className="notice"><AlertTriangle size={17}/> Review the source documents and evidence before relying on this assessment.</div>{compliance.length>0 && <div className="table-wrap"><table><thead><tr><th>Clause / page</th><th>Requirement</th><th>Category</th><th>Status</th><th>Gap / risk</th></tr></thead><tbody>{compliance.map(c=><tr key={c.id}><td>{c.clause_reference||'—'} / {c.page_number||'—'}</td><td>{c.requirement}</td><td>{c.category}</td><td>{c.status}</td><td>{c.gap_or_risk||'—'}</td></tr>)}</tbody></table></div>}</> : <div className="notice"><CircleHelp size={17}/> Attach the main tender, ATC, BOQ, annexures and corrigenda, then run the assessment. Only company evidence marked verified is used as proof of eligibility.</div>}
    </section>
  </div>;
}

function CreateTender({onClose,onCreate}) {
  const [form,setForm]=useState({title:'',tender_reference:'',procuring_entity:'',portal:'GeM',bid_value_inr:'',emd_inr:'',submission_deadline:'',delivery_location:''});
  return <div className="overlay"><form className="modal" onSubmit={e=>{e.preventDefault();onCreate(form);}}><div className="modal-head"><div><h3>Create tender record</h3><p>Enter the basic bid details before attaching documents.</p></div><button type="button" className="icon-btn" onClick={onClose}><X/></button></div>
    <label>Tender title<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>Tender / GeM reference<input value={form.tender_reference} onChange={e=>setForm({...form,tender_reference:e.target.value})}/></label><label>Procuring entity<input value={form.procuring_entity} onChange={e=>setForm({...form,procuring_entity:e.target.value})}/></label><div className="form-row"><label>Portal<input value={form.portal} onChange={e=>setForm({...form,portal:e.target.value})}/></label><label>Estimated bid value (INR)<input type="number" min="0" value={form.bid_value_inr} onChange={e=>setForm({...form,bid_value_inr:e.target.value})}/></label></div><div className="form-row"><label>EMD (INR)<input type="number" min="0" value={form.emd_inr} onChange={e=>setForm({...form,emd_inr:e.target.value})}/></label><label>Submission deadline<input type="datetime-local" value={form.submission_deadline} onChange={e=>setForm({...form,submission_deadline:e.target.value})}/></label></div><label>Delivery location<input value={form.delivery_location} onChange={e=>setForm({...form,delivery_location:e.target.value})}/></label>
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary">Create tender</button></div></form></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
