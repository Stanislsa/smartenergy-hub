import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowDownToLine, Check, Clock3, Database, Eye, FileJson2, FileSpreadsheet, Gauge, RefreshCw, Save, ShieldCheck, Sparkles, X, Play, Pause, Trash2, FileText } from 'lucide-react';
import { api, downloadExport } from '../api/client';
import { Card, ErrorBox, Field, PageHead, SensorSelect } from '../components/ui';
import EmptyState from '../components/EmptyState';
import { daysAgoIso, daysRange, todayIso } from '../utils';

const DEFINITIONS = {
  measurements: [
    ['sensorId', 'Capteur'], ['timestamp', 'Date et heure'], ['powerKw', 'Puissance (kW)'],
    ['voltage', 'Tension (V)'], ['current', 'Courant (A)'], ['frequency', 'Fréquence (Hz)'], ['temperature', 'Température (°C)'], ['measurementCount', 'Nombre de mesures'],
  ],
  anomalies: [
    ['sensorId', 'Capteur'], ['timestamp', 'Date et heure'], ['method', 'Type'], ['powerKw', 'Puissance (kW)'],
    ['score', 'Score'], ['limit', 'Seuil'], ['value', 'Valeur observée'],
  ],
};
const TEMPLATE_KEY = 'smartenergy.export-templates';
const LAST_KEY = 'smartenergy.export-last';

function stableItemKey(value, index) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object') return value.$oid || JSON.stringify(value);
  return 'export-item-' + index;
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
}

function initialConfig() {
  const saved = readJson(LAST_KEY, {});
  return {
    kind: saved.kind || 'measurements',
    sensorId: saved.sensorId || '',
    start: saved.start || daysAgoIso(6),
    end: saved.end || todayIso(),
    format: saved.format || 'csv',
    aggregate: saved.aggregate || 'none',
    method: saved.method || '',
    gzip: Boolean(saved.gzip),
    columns: saved.columns || DEFINITIONS.measurements.map(c => c[0]),
  };
}

function formatBytes(bytes) {
  return bytes < 1024 * 1024 ? Math.round(bytes / 1024) + ' Ko' : (bytes / 1024 / 1024).toFixed(1) + ' Mo';
}

export default function Exports() {
  const [config, setConfig] = useState(initialConfig);
  const [templates, setTemplates] = useState(() => readJson(TEMPLATE_KEY, []));
  const [templateName, setTemplateName] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [busyPreview, setBusyPreview] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [error, setError] = useState(null);
  const [controller, setController] = useState(null);
  const [frequency, setFrequency] = useState('DAILY');
  const [destination, setDestination] = useState('LOCAL');
  const [recipient, setRecipient] = useState('');
  const [scheduleError, setScheduleError] = useState(null);
  const queryClient = useQueryClient();
  const { data: sensors, error: sensorError, refetch: refreshSensors } = useQuery({
    queryKey: ['sensors'], queryFn: api.sensors, staleTime: 60_000,
  });
  const { data: history, isFetching: historyLoading, refetch: refreshHistory } = useQuery({
    queryKey: ['export-history'], queryFn: api.exportHistory, staleTime: 15_000,
  });
  const { data: schedules, refetch: refreshSchedules } = useQuery({
    queryKey: ['export-schedules'], queryFn: api.exportSchedules, staleTime: 15_000,
  });
  const columns = DEFINITIONS[config.kind];
  const allSelected = config.columns.length === columns.length;

  useEffect(() => {
    localStorage.setItem(LAST_KEY, JSON.stringify(config));
  }, [config]);

  const updateKind = kind => setConfig(current => ({ ...current, kind, columns: DEFINITIONS[kind].map(c => c[0]), aggregate: 'none', method: '' }));
  const toggleColumn = key => setConfig(current => ({
    ...current,
    columns: current.columns.includes(key) ? current.columns.filter(c => c !== key) : [...current.columns, key],
  }));

  const previewData = async () => {
    setPreview(null); setPreviewError(null); setBusyPreview(true);
    try {
      if (!config.sensorId) throw new Error('Choisissez un capteur pour afficher l’aperçu.');
      const { from, to } = daysRange(config.start, config.end);
      setPreview(await api.exportPreview(config.sensorId, from, to));
    } catch (e) { setPreviewError(e.message); }
    finally { setBusyPreview(false); }
  };

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) return;
    const next = [...templates.filter(t => t.name !== name), { name, config: { ...config } }];
    setTemplates(next); localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next)); setTemplateName('');
  };
  const loadTemplate = event => {
    const template = templates.find(t => t.name === event.target.value);
    if (template) setConfig(template.config);
  };

  const runExport = async () => {
    if (busyExport || config.columns.length === 0) return;
    setError(null); setBusyExport(true); setProgress({ loaded: 0, total: 0 });
    const aborter = new AbortController(); setController(aborter);
    let writable = null;
    const chunks = [];
    try {
      const { from, to } = daysRange(config.start, config.end);
      const params = {
        sensorId: config.sensorId,
        from, to, format: config.format, columns: config.columns.join(','),
        gzip: config.gzip, ...(config.kind === 'measurements' ? { aggregate: config.aggregate } : {}),
        ...(config.kind === 'anomalies' && config.method ? { method: config.method } : {}),
      };
      const response = await downloadExport(config.kind, params, aborter.signal);
      const filename = config.kind + '-' + config.start + '-' + config.end + '.' + config.format + (config.gzip ? '.gz' : '');
      const canWrite = typeof window.showSaveFilePicker === 'function';
      if (canWrite) {
        const handle = await window.showSaveFilePicker({ suggestedName: filename });
        writable = await handle.createWritable();
      }
      const total = Number(response.headers.get('content-length')) || 0;
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (writable) await writable.write(value);
        else chunks.push(value);
        setProgress(current => ({ loaded: current.loaded + value.byteLength, total }));
      }
      if (writable) await writable.close();
      else {
        const blob = new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      }
      await queryClient.invalidateQueries({ queryKey: ['export-history'] });
      await refreshHistory();
    } catch (e) {
      if (writable) { try { await writable.abort(); } catch {} }
      if (e.name !== 'AbortError') setError(e.message || 'Le téléchargement a échoué.');
    } finally {
      setBusyExport(false); setController(null);
    }
  };

  useEffect(() => {
    const onKey = event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault(); runExport();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const selectAll = () => setConfig(current => ({ ...current, columns: allSelected ? [] : columns.map(c => c[0]) }));
  const createSchedule = async () => {
    setScheduleError(null);
    try {
      await api.createExportSchedule({
        kind: config.kind, sensorId: config.sensorId, frequency, destination, email: recipient,
        format: config.format, columns: config.columns, aggregate: config.aggregate, method: config.method, gzip: config.gzip,
      });
      await queryClient.invalidateQueries({ queryKey: ['export-schedules'] });
      await refreshSchedules();
    } catch (e) { setScheduleError(e.message); }
  };
  const updateSchedule = async item => {
    try { await api.updateExportSchedule(item._id, !item.enabled); await refreshSchedules(); }
    catch (e) { setScheduleError(e.message); }
  };
  const removeSchedule = async item => {
    try { await api.deleteExportSchedule(item._id); await refreshSchedules(); }
    catch (e) { setScheduleError(e.message); }
  };
  const rangeDays = (new Date(config.end) - new Date(config.start)) / 86_400_000 + 1;
  const rangeValid = config.start && config.end && rangeDays >= 1 && rangeDays <= (config.kind === 'anomalies' ? 31 : 365);
  const loadedPercent = progress.total ? Math.min(100, Math.round(progress.loaded / progress.total * 100)) : 0;

  return (
    <>
      <PageHead title="Centre d’export" subtitle="Configurez, prévisualisez et téléchargez vos données énergétiques en toute sécurité."
        actions={<button className="btn ghost sm" onClick={() => { refreshHistory(); refreshSensors(); }}><RefreshCw size={14} /> Actualiser</button>} />
      <div className="export-intro">
        <span className="export-intro-icon"><Sparkles size={20} /></span>
        <div><b>Vos données, prêtes à l’emploi</b><p>Les fichiers sont générés par l’API, transmis en flux et peuvent être compressés pour les longues périodes.</p></div>
        <span className="export-security"><ShieldCheck size={15} /> Accès sécurisé</span>
      </div>

      <div className="export-layout">
        <div className="export-main">
          <Card title="1. Périmètre des données" icon={Database}>
            <div className="export-fields">
              <Field label="Je souhaite exporter">
                <select value={config.kind} onChange={e => updateKind(e.target.value)}>
                  <option value="measurements">Mesures énergétiques</option>
                  <option value="anomalies">Anomalies détectées</option>
                </select>
              </Field>
              <Field label="Capteur">
                <SensorSelect sensors={sensors} value={config.sensorId} allowAll onChange={v => setConfig({ ...config, sensorId: v })} />
              </Field>
              <Field label="Du"><input type="date" value={config.start} onChange={e => setConfig({ ...config, start: e.target.value })} /></Field>
              <Field label="Au"><input type="date" value={config.end} onChange={e => setConfig({ ...config, end: e.target.value })} /></Field>
              {config.kind === 'measurements' ? (
                <Field label="Regrouper les mesures">
                  <select value={config.aggregate} onChange={e => setConfig({ ...config, aggregate: e.target.value })}>
                    <option value="none">Données détaillées</option><option value="hour">Moyenne par heure</option><option value="day">Moyenne par jour</option><option value="week">Moyenne par semaine</option>
                  </select>
                </Field>
              ) : (
                <Field label="Type d’anomalie">
                  <select value={config.method} onChange={e => setConfig({ ...config, method: e.target.value })}>
                    <option value="">Tous les types</option>
                    <option value="THRESHOLD">Dépassement de seuil</option><option value="Z_SCORE">Écart statistique</option>
                    <option value="POWER_VARIATION">Variation de puissance</option><option value="VOLTAGE">Tension</option><option value="TEMPERATURE">Température</option>
                  </select>
                </Field>
              )}
            </div>
            <p className="export-help">Mesures : jusqu’à 365 jours. Anomalies : jusqu’à 31 jours, conformément au calcul analytics actuel.</p>
          </Card>

          <Card title="2. Format et champs" icon={FileSpreadsheet}>
            <div className="export-format-row">
              <label className={'export-format ' + (config.format === 'csv' ? 'selected' : '')}>
                <input type="radio" name="format" value="csv" checked={config.format === 'csv'} onChange={() => setConfig({ ...config, format: 'csv' })} />
                <FileSpreadsheet size={20} /><span><b>CSV</b><small>Excel, tableurs, traitements</small></span>
              </label>
              <label className={'export-format ' + (config.format === 'json' ? 'selected' : '')}>
                <input type="radio" name="format" value="json" checked={config.format === 'json'} onChange={() => setConfig({ ...config, format: 'json' })} />
                <FileJson2 size={20} /><span><b>JSON</b><small>Intégration et développement</small></span>
              </label>
              <label className={'export-format ' + (config.format === 'xlsx' ? 'selected' : '')}>
                <input type="radio" name="format" value="xlsx" checked={config.format === 'xlsx'} onChange={() => setConfig({ ...config, format: 'xlsx' })} />
                <FileSpreadsheet size={20} /><span><b>Excel</b><small>Classeur .xlsx avec métadonnées</small></span>
              </label>
              <label className={'export-format ' + (config.format === 'pdf' ? 'selected' : '')}>
                <input type="radio" name="format" value="pdf" checked={config.format === 'pdf'} onChange={() => setConfig({ ...config, format: 'pdf' })} />
                <FileText size={20} /><span><b>PDF</b><small>Rapport paginé prêt à partager</small></span>
              </label>
              <label className={'export-format ' + (config.format === 'parquet' ? 'selected' : '')}>
                <input type="radio" name="format" value="parquet" checked={config.format === 'parquet'} onChange={() => setConfig({ ...config, format: 'parquet' })} />
                <Database size={20} /><span><b>Parquet</b><small>Format colonnaire pour le Big Data</small></span>
              </label>
            </div>
            <div className="export-column-head"><div><b>Colonnes à inclure</b><small>{config.columns.length} sur {columns.length} sélectionnées</small></div><button type="button" className="text-btn" onClick={selectAll}>{allSelected ? 'Tout retirer' : 'Tout sélectionner'}</button></div>
            <div className="export-columns">
              {columns.map(([key, label]) => <label key={key}><input type="checkbox" checked={config.columns.includes(key)} onChange={() => toggleColumn(key)} />{label}</label>)}
            </div>
            <label className="export-compress"><input type="checkbox" checked={config.gzip} onChange={e => setConfig({ ...config, gzip: e.target.checked })} /><span><b>Compresser en GZIP</b><small>Réduit la taille du fichier pour les exports volumineux.</small></span></label>
          </Card>

          <Card title="3. Aperçu avant téléchargement" icon={Eye}>
            <div className="export-preview-actions">
              <span className="muted">Aperçu limité aux 20 premières lignes d’un capteur.</span>
              <button className="btn ghost sm" disabled={busyPreview || !config.sensorId} onClick={previewData}>{busyPreview ? 'Préparation…' : <><Eye size={14} /> Générer l’aperçu</>}</button>
            </div>
            {previewError && <div className="state error">{previewError}</div>}
            {preview && <div className="table-wrap export-preview-table"><table><thead><tr>{columns.filter(([key]) => config.columns.includes(key)).map(([key,label]) => <th key={key}>{label}</th>)}</tr></thead><tbody>{preview.rows.map((row,index) => <tr key={index}>{columns.filter(([key]) => config.columns.includes(key)).map(([key]) => <td key={key}>{row[key] == null ? '—' : String(row[key])}</td>)}</tr>)}</tbody></table>{preview.rows.length===0 && <EmptyState title="Aucune donnée" description="Aucune mesure pour les filtres sélectionnés." />}</div>}
          </Card>
        </div>

        <aside className="export-side">
          <Card title="Résumé de l’export" icon={Gauge}>
            <div className="export-summary-line"><span>Contenu</span><b>{config.kind === 'measurements' ? 'Mesures' : 'Anomalies'}</b></div>
            <div className="export-summary-line"><span>Plage</span><b>{config.start} → {config.end}</b></div>
            <div className="export-summary-line"><span>Format</span><b>{config.format.toUpperCase()}{config.gzip ? ' · GZIP' : ''}</b></div>
            <div className="export-summary-line"><span>Champs</span><b>{config.columns.length}</b></div>
            {busyExport && <div className="export-progress"><div><span>{formatBytes(progress.loaded)} reçus</span><b>{progress.total ? loadedPercent + '%' : 'En flux'}</b></div><progress max="100" value={loadedPercent} /><button className="btn ghost sm" onClick={() => controller?.abort()}><X size={14} /> Annuler</button></div>}
            {error && <div className="state error">{error}</div>}
            <button className="btn export-submit" disabled={!rangeValid || !config.columns.length || busyExport} onClick={runExport}>{busyExport ? <><Activity className="spin" size={16} /> Export en cours…</> : <><ArrowDownToLine size={17} /> Télécharger l’export</>}</button>
            <small className="export-shortcut">Raccourci : Ctrl/⌘ + Entrée</small>
          </Card>
          <Card title="Modèles enregistrés" icon={Save}>
            <Field label="Charger un modèle"><select defaultValue="" onChange={loadTemplate}><option value="">Choisir un modèle…</option>{templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}</select></Field>
            <div className="export-template-save"><input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nom du modèle" /><button className="btn ghost sm" onClick={saveTemplate} disabled={!templateName.trim()}><Save size={14} /> Enregistrer</button></div>
            <small className="export-help">Les modèles sont conservés sur cet appareil.</small>
          </Card>
          <Card title="Exports récents" icon={Clock3} actions={<button className="icon-btn" aria-label="Rafraîchir l’historique" onClick={refreshHistory}><RefreshCw size={15} /></button>}>
            {historyLoading && <p className="muted">Chargement de l’historique…</p>}
            {history?.length ? <div className="export-history-list">{history.map(item => <div className="export-history-item" key={item.exportId}><span className={'export-history-mark ' + (item.status === 'completed' ? 'done' : '')}>{item.status === 'completed' ? <Check size={14} /> : <Clock3 size={14} />}</span><div><b>{item.type === 'measurements' ? 'Mesures' : 'Anomalies'} · {String(item.format).toUpperCase()}</b><small>{new Date(item.completedAt || item.generatedAt).toLocaleString('fr-FR')} · {item.rows ?? 0} lignes</small></div></div>)}</div> : !historyLoading && <p className="muted">Vos exports terminés apparaîtront ici.</p>}
          </Card>
          <Card title="Exports planifiés" icon={Clock3}>
            <p className="export-help">Créez un export quotidien ou hebdomadaire. Il sera produit côté serveur à la prochaine échéance.</p>
            <div className="export-schedule-fields">
              <Field label="Fréquence"><select value={frequency} onChange={e => setFrequency(e.target.value)}><option value="DAILY">Chaque jour</option><option value="WEEKLY">Chaque semaine</option></select></Field>
              <Field label="Destination"><select value={destination} onChange={e => setDestination(e.target.value)}><option value="LOCAL">Stockage serveur</option><option value="EMAIL">Email</option><option value="S3">S3 / MinIO</option><option value="EMAIL_AND_S3">Email + S3</option></select></Field>
              {destination.includes('EMAIL') && <Field label="Adresse email"><input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="equipe@exemple.fr" /></Field>}
            </div>
            {scheduleError && <div className="state error">{scheduleError}</div>}
            <button className="btn ghost sm export-schedule-create" onClick={createSchedule} disabled={destination.includes('EMAIL') && !recipient.includes('@')}><Clock3 size={14} /> Planifier cet export</button>
            <small className="export-help">Email et S3 nécessitent des identifiants SMTP et S3/MinIO configurés côté serveur.</small>
            {schedules?.length > 0 && <div className="export-history-list export-schedule-list">{schedules.map((item, index) => <div className="export-schedule-item" key={stableItemKey(item._id, index)}><div><b>{item.kind === 'measurements' ? 'Mesures' : 'Anomalies'} · {item.frequency === 'DAILY' ? 'Quotidien' : 'Hebdomadaire'}</b><small>{String(item.format).toUpperCase()} · {item.destination} · prochain : {new Date(item.nextRunAt).toLocaleString('fr-FR')}</small>{item.lastStatus && <small className={item.lastStatus === 'failed' ? 'export-failed' : ''}>Dernier état : {item.lastStatus}{item.lastMessage ? ' — ' + item.lastMessage : ''}</small>}</div><button className="icon-btn" title={item.enabled ? 'Suspendre' : 'Reprendre'} onClick={() => updateSchedule(item)}>{item.enabled ? <Pause size={15} /> : <Play size={15} />}</button><button className="icon-btn" title="Supprimer" onClick={() => removeSchedule(item)}><Trash2 size={15} /></button></div>)}</div>}
          </Card>
        </aside>
      </div>
      <ErrorBox error={sensorError} onRetry={refreshSensors} />
    </>
  );
}
