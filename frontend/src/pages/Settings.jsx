import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellRing, Clock3, Cpu, Database, Gauge, Save, Settings as SettingsIcon } from 'lucide-react';
import { Card, ErrorBox, Field, PageHead, Status } from '../components/ui';
import { SERVICES, useServices } from '../services';
import { api } from '../api/client';

const PREFS_KEY = 'smartenergy.preferences';

function readPreferences() {
  try {
    return { refreshSeconds: 30, forecastModel: 'rf', ...(JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')) };
  } catch {
    return { refreshSeconds: 30, forecastModel: 'rf' };
  }
}

export default function Settings() {
  const [prefs, setPrefs] = useState(readPreferences);
  const [saved, setSaved] = useState(false);
  const services = useServices();
  const statusQuery = useQuery({ queryKey: ['settings-model-status'], queryFn: api.modelStatus, staleTime: 60_000 });

  const update = (key, value) => {
    setPrefs(current => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = event => {
    event.preventDefault();
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent('smartenergy:preferences-changed', { detail: prefs }));
    setSaved(true);
  };

  return (
    <>
      <PageHead title="Paramètres" subtitle="Préférences de votre espace de supervision" />
      {saved && <div className="state success-notice" role="status">Préférences enregistrées sur cet appareil.</div>}
      <form className="settings-grid" onSubmit={save}>
        <Card title="Préférences d’affichage" icon={SettingsIcon}>
          <div className="settings-fields">
            <Field label="Actualisation des états système">
              <select value={prefs.refreshSeconds} onChange={event => update('refreshSeconds', Number(event.target.value))}>
                <option value={15}>Toutes les 15 secondes</option><option value={30}>Toutes les 30 secondes</option><option value={60}>Toutes les minutes</option>
              </select>
            </Field>
            <Field label="Modèle de prévision par défaut">
              <select value={prefs.forecastModel} onChange={event => update('forecastModel', event.target.value)}>
                <option value="rf">Random Forest · court terme</option><option value="lstm">LSTM · long terme</option>
              </select>
            </Field>
          </div>
          <p className="settings-note">Ces préférences sont enregistrées dans le navigateur utilisé et s’appliquent à ce poste.</p>
          <button className="btn settings-save"><Save size={15} /> Enregistrer les préférences</button>
        </Card>
        <Card title="État de la plateforme" icon={Database}>
          <div className="settings-service-list">
            {SERVICES.map(service => <div className="settings-service" key={service.key}><span>{service.label}</span><Status ok={services?.[service.key]} warn={services == null} warnLabel="Vérification…" okLabel="En ligne" koLabel="Indisponible" /></div>)}
          </div>
        </Card>
        <Card title="Modèle de détection IA" icon={Cpu}>
          {statusQuery.error && <ErrorBox error={statusQuery.error} onRetry={() => statusQuery.refetch()} />}
          {statusQuery.data && <dl className="kv"><dt>État</dt><dd>{statusQuery.data.status}</dd><dt>Version</dt><dd>{statusQuery.data.version}</dd><dt>Entraîné le</dt><dd>{statusQuery.data.last_trained ? new Date(statusQuery.data.last_trained).toLocaleString('fr-FR') : 'Information indisponible'}</dd><dt>Type</dt><dd>{statusQuery.data.model_type}</dd></dl>}
          {!statusQuery.data && !statusQuery.error && <div className="state muted">Chargement des informations du modèle…</div>}
        </Card>
        <Card title="Notifications et accès" icon={BellRing}>
          <div className="settings-placeholder"><BellRing size={19} /><div><b>Règles d’alerte</b><p>La configuration centralisée des seuils et les notifications d’équipe nécessitent un service d’administration et des comptes sécurisés.</p></div></div>
          <div className="settings-placeholder"><Gauge size={19} /><div><b>Utilisateurs et rôles</b><p>La gestion ADMIN / VIEWER sera disponible lorsque l’authentification sera activée côté serveur.</p></div></div>
          <div className="settings-placeholder"><Clock3 size={19} /><div><b>Historique de conservation</b><p>Les mesures sont gérées par les services de stockage de la plateforme.</p></div></div>
        </Card>
      </form>
    </>
  );
}
