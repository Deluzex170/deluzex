"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Plus, Save, Eye, Trash2 } from "lucide-react";
import {
  loadEmailTemplates, saveEmailTemplate, deleteEmailTemplate, previewEmailTemplate,
  type EmailTemplate, type EmailTemplateInput, type TemplateCatalog, type TemplatePreview,
} from "../../services/emailTemplates";
import styles from "./templates.module.css";

const eventName = (event: string | null) => event === "verification" ? "Email verification"
  : event === "password_reset" ? "Password reset" : "Not assigned";

export default function EmailTemplatesPage() {
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  const [draft, setDraft] = useState<EmailTemplateInput | null>(null);
  const [editingId, setEditingId] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const revision = useRef(0);
  const nameInput = useRef<HTMLInputElement>(null);
  const editorOpen = Boolean(draft);

  const reload = useCallback(async () => setCatalog(await loadEmailTemplates()), []);
  useEffect(() => { reload().catch((err: Error) => setError(err.message)); }, [reload]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => { if (editorOpen) nameInput.current?.focus(); }, [editingId, editorOpen]);

  function open(input: EmailTemplateInput, id?: string) {
    if (dirty && !window.confirm("Discard your unsaved template changes?")) return;
    setDraft({ ...input }); setEditingId(id); setDirty(false);
    setPreview(null); setError(""); setStatus(""); revision.current++;
  }
  function change(key: keyof EmailTemplateInput, value: string | null) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setDirty(true); setPreview(null); revision.current++;
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const active = catalog?.items.find((item) => item.event === draft.event && item.id !== editingId);
    if (draft.event && active && !window.confirm(`Use this template for ${eventName(draft.event)} instead of “${active.name}”?`)) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const saved = await saveEmailTemplate(draft, editingId);
      setDraft(saved); setEditingId(saved.id); setDirty(false);
      await reload(); setStatus("Template saved. New emails will use the assigned template.");
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setBusy(false); }
  }
  async function remove(item: EmailTemplate) {
    if (dirty && !window.confirm("Discard unsaved changes before deleting?")) return;
    if (!window.confirm(`Delete “${item.name}”? ${item.event ? "Its emails will use the system default." : "This cannot be undone."}`)) return;
    setBusy(true); setError(""); setStatus("");
    try {
      await deleteEmailTemplate(item.id); await reload();
      setDraft(null); setEditingId(undefined); setDirty(false); setPreview(null); revision.current++;
      setStatus("Template deleted. Any assigned email now uses the system default.");
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed."); }
    finally { setBusy(false); }
  }
  async function showPreview() {
    if (!draft) return;
    const currentRevision = revision.current;
    setBusy(true); setError("");
    try {
      const rendered = await previewEmailTemplate(draft);
      if (currentRevision === revision.current) setPreview(rendered);
    } catch (err) { setError(err instanceof Error ? err.message : "Preview failed."); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}><Mail size={16} aria-hidden="true" /> CUSTOMER EMAILS</span>
        <h1>Email templates</h1><p>Manage verification and password-reset emails in one place.</p></div>
      <button type="button" disabled={!catalog || busy} onClick={() => catalog && open({ ...catalog.defaults[0], name: "New email template", event: null })}>
        <Plus size={17} aria-hidden="true" /> Create template</button>
    </header>
    {error && <div className={styles.error} role="alert">{error} {!catalog && <button type="button" onClick={() => { setError(""); reload().catch((err: Error) => setError(err.message)); }}>Retry</button>}</div>}
    {status && <div className={styles.success} role="status">{status}</div>}
    {!catalog && !error && <p role="status">Loading email templates…</p>}
    {catalog && <div className={styles.layout}>
      <aside className={styles.library} aria-label="Template library">
        <h2>Automated emails</h2>
        {catalog.defaults.map((item) => {
          const active = catalog.items.find((custom) => custom.event === item.event);
          return <section className={styles.card} key={item.event}>
            <h3>{eventName(item.event)}</h3><p>Using: {active ? active.name : "System default"}</p>
            <button type="button" disabled={busy} className={styles.secondary} onClick={() => active ? open(active, active.id) : open(item)}>
              {active ? "Edit active template" : "Customize default"}</button>
          </section>;
        })}
        <h2>Saved templates <span className={styles.count}>{catalog.items.length}</span></h2>
        {catalog.items.length === 0 && <p className={styles.hint}>No custom templates yet. Customize a default or create your own.</p>}
        {catalog.items.map((item) => <div className={`${styles.saved} ${item.id === editingId ? styles.selected : ""}`} key={item.id}>
          <button type="button" disabled={busy} className={styles.templateButton} onClick={() => open(item, item.id)}>
            <strong>{item.name}</strong><span>{eventName(item.event)}</span></button>
          <button type="button" disabled={busy} className={styles.delete} aria-label={`Delete ${item.name}`} onClick={() => remove(item)}><Trash2 size={17} aria-hidden="true" /></button>
        </div>)}
      </aside>
      <section className={styles.editor} aria-label="Template editor">
        {!draft ? <div className={styles.empty}><Mail size={36} aria-hidden="true" /><h2>Make every email feel like Deluzex</h2>
          <p>Choose a template to edit its subject, plain text and HTML. Preview uses a sample code and sends no email.</p></div>
          : <form onSubmit={save}>
            <div className={styles.editorTitle}><h2>{editingId ? "Edit template" : "Create template"}</h2>{dirty && <span>Unsaved changes</span>}</div>
            <fieldset disabled={busy}>
              <div className={styles.row}>
                <label htmlFor="template-name">Template name<input ref={nameInput} id="template-name" required maxLength={120} value={draft.name} onChange={(e) => change("name", e.target.value)} /></label>
                <label htmlFor="template-event">Use for<select id="template-event" value={draft.event || ""} onChange={(e) => change("event", e.target.value || null)}>
                  <option value="">Not assigned (save as draft)</option><option value="verification">Email verification</option><option value="password_reset">Password reset</option></select></label>
              </div>
              <p className={styles.hint}>Assigning an email replaces its current template. Deleting or unassigning it restores the system default.</p>
              <label htmlFor="template-subject">Subject<input id="template-subject" required maxLength={240} value={draft.subject} onChange={(e) => change("subject", e.target.value)} /></label>
              <div className={styles.variables}><span>Available placeholders</span><div>{catalog.variables.map((variable) => <code key={variable}>{`{{${variable}}}`}</code>)}</div></div>
              <label htmlFor="template-text">Plain-text body<textarea id="template-text" required rows={5} maxLength={50000} value={draft.text_body} onChange={(e) => change("text_body", e.target.value)} /></label>
              <label htmlFor="template-html">HTML body<textarea id="template-html" className={styles.code} required rows={12} maxLength={100000} value={draft.html_body} onChange={(e) => change("html_body", e.target.value)} /></label>
              <p className={styles.hint}>Verification templates require {"{{otp}}"} in both bodies. Placeholder values are escaped in HTML.</p>
              <div className={styles.actions}><button type="submit"><Save size={17} aria-hidden="true" /> {busy ? "Working…" : "Save template"}</button>
                <button type="button" className={styles.secondary} onClick={showPreview}><Eye size={17} aria-hidden="true" /> Preview</button>
                <button type="button" className={styles.secondary} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) { setDraft(null); setDirty(false); setEditingId(undefined); setPreview(null); revision.current++; } }}>Cancel</button></div>
            </fieldset>
            {preview && <section className={styles.preview} aria-label="Email preview">
              <h3>Preview: {preview.subject}</h3>
              <iframe title="Email HTML preview" sandbox="" referrerPolicy="no-referrer" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${preview.html_body}`} />
              <details><summary>Plain-text preview</summary><pre>{preview.text_body}</pre></details>
            </section>}
          </form>}
      </section>
    </div>}
  </main>;
}
