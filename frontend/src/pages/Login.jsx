import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { saveSession } from '../auth/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const from = location.state?.from?.pathname || '/';

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await api.login(username.trim(), password);
      saveSession(session);
      await queryClient.invalidateQueries();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="sh-login-page">
      <style>{`
        .sh-login-page, .sh-login-page * { box-sizing: border-box; }
        .sh-login-page { min-height: 100vh; padding: 28px; display: flex; align-items: center; justify-content: center; background: #f3f6fc; color: #102044; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .sh-login-shell { width: min(1080px, 100%); min-height: 620px; display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; border: 1px solid #e4eaf4; border-radius: 24px; background: #fff; box-shadow: 0 24px 70px rgba(20, 43, 86, .12); }
        .sh-login-brand { position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 42px; overflow: hidden; color: #fff; background: #101d3e; }
        .sh-login-brand:before, .sh-login-brand:after { content: ""; position: absolute; border-radius: 50%; pointer-events: none; }
        .sh-login-brand:before { width: 370px; height: 370px; right: -150px; top: 100px; border: 1px solid rgba(255,255,255,.10); box-shadow: 0 0 0 38px rgba(255,255,255,.025), 0 0 0 78px rgba(255,255,255,.02); }
        .sh-login-brand:after { width: 260px; height: 260px; left: -150px; bottom: -130px; background: rgba(37, 99, 235, .16); }
        .sh-login-brand > * { position: relative; z-index: 1; }
        .sh-login-logo { display: flex; align-items: center; gap: 12px; font-size: 21px; font-weight: 750; letter-spacing: -.5px; }
        .sh-login-logo-mark { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 13px; background: #102c58; color: #22c55e; }
        .sh-login-logo-name span { color: #22c55e; }
        .sh-login-intro { max-width: 420px; margin: 58px 0; }
        .sh-login-eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; padding: 8px 12px; border: 1px solid rgba(255,255,255,.13); border-radius: 999px; background: rgba(255,255,255,.06); color: #dbeafe; font-size: 12px; font-weight: 650; letter-spacing: .5px; text-transform: uppercase; }
        .sh-login-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 4px rgba(34,197,94,.13); }
        .sh-login-intro h1 { margin: 0 0 18px; font-size: clamp(32px, 4vw, 43px); line-height: 1.12; letter-spacing: -1.6px; font-weight: 760; }
        .sh-login-intro h1 span { color: #34d399; }
        .sh-login-intro p { max-width: 370px; margin: 0; color: #b9c7df; font-size: 15px; line-height: 1.8; }
        .sh-login-feature { display: flex; align-items: center; gap: 13px; margin-top: 30px; color: #dbe5f5; font-size: 13px; }
        .sh-login-feature-icon { display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: rgba(255,255,255,.06); color: #60a5fa; }
        .sh-login-footer { color: #91a3c1; font-size: 12px; }
        .sh-login-form-side { display: flex; align-items: center; justify-content: center; padding: 46px; }
        .sh-login-form-wrap { width: 100%; max-width: 370px; }
        .sh-login-mobile-logo { display: none; }
        .sh-login-form-wrap h2 { margin: 0 0 9px; color: #102044; font-size: 29px; letter-spacing: -.8px; }
        .sh-login-subtitle { margin: 0 0 32px; color: #6c7d99; font-size: 14px; line-height: 1.6; }
        .sh-login-field { display: block; margin-bottom: 20px; }
        .sh-login-field > span { display: block; margin-bottom: 9px; color: #243653; font-size: 13px; font-weight: 650; }
        .sh-login-input-wrap { position: relative; }
        .sh-login-input-icon { position: absolute; top: 50%; left: 15px; transform: translateY(-50%); color: #8190a9; display: flex; }
        .sh-login-field input { display: block; width: 100%; height: 50px; padding: 0 14px 0 44px; outline: none; border: 1px solid #dce4f0; border-radius: 11px; background: #fbfcff; color: #102044; font: inherit; font-size: 14px; transition: border-color .18s, box-shadow .18s, background .18s; }
        .sh-login-field input::placeholder { color: #9aa7bb; }
        .sh-login-field input:focus { border-color: #2563eb; background: #fff; box-shadow: 0 0 0 4px rgba(37,99,235,.10); }
        .sh-login-error { margin: 0 0 18px; padding: 11px 13px; border: 1px solid #fecaca; border-radius: 10px; background: #fff1f2; color: #b91c1c; font-size: 13px; line-height: 1.5; }
        .sh-login-submit { width: 100%; min-height: 50px; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 8px; border: 0; border-radius: 11px; background: #2563eb; color: #fff; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 18px rgba(37,99,235,.20); transition: transform .15s, background .15s, box-shadow .15s; }
        .sh-login-submit:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 10px 22px rgba(37,99,235,.25); }
        .sh-login-submit:disabled { cursor: wait; opacity: .72; }
        .sh-login-secure { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 24px; color: #8391a8; font-size: 12px; }
        .sh-login-bottom { margin-top: 50px; padding-top: 20px; border-top: 1px solid #edf1f7; color: #9aa6b8; font-size: 11px; text-align: center; }
        @media (max-width: 760px) { .sh-login-page { padding: 14px; align-items: flex-start; } .sh-login-shell { grid-template-columns: 1fr; min-height: 0; border-radius: 18px; } .sh-login-brand { display: none; } .sh-login-form-side { padding: 34px 24px 28px; } .sh-login-mobile-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 36px; font-size: 18px; font-weight: 750; } .sh-login-mobile-logo span { color: #10b981; } .sh-login-mobile-logo-mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 11px; background: #101d3e; color: #22c55e; } .sh-login-bottom { margin-top: 34px; } }
        @media (prefers-reduced-motion: reduce) { .sh-login-page * { transition: none !important; } }
      `}</style>

      <section className="sh-login-shell" aria-label="Connexion SmartEnergy Hub">
        <aside className="sh-login-brand">
          <div className="sh-login-logo">
            <div className="sh-login-logo-mark" aria-hidden="true">
              <svg width="25" height="25" viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 1.8 4.9 13a1 1 0 0 0 .8 1.6h5.1l-.9 7.6 9.2-12a1 1 0 0 0-.8-1.6h-5.1l1.1-6.1a.7.7 0 0 0-1.1-.7Z" /></svg>
            </div>
            <div className="sh-login-logo-name">SmartEnergy <span>Hub</span></div>
          </div>

          <div className="sh-login-intro">
            <div className="sh-login-eyebrow"><span className="sh-login-dot" /> Gestion énergétique intelligente</div>
            <h1>Maîtrisez votre énergie.<br /><span>En toute simplicité.</span></h1>
            <p>Suivez vos capteurs, analysez vos consommations et gardez une vue claire sur la performance énergétique de vos bâtiments.</p>
            <div className="sh-login-feature">
              <div className="sh-login-feature-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg></div>
              <div><strong>Vos données en un coup d'œil</strong><br /><span style={{ color: '#91a3c1' }}>Mesures, anomalies et résumés quotidiens</span></div>
            </div>
          </div>

          <div className="sh-login-footer">© {new Date().getFullYear()} SmartEnergy Hub · Plateforme de supervision énergétique</div>
        </aside>

        <div className="sh-login-form-side">
          <div className="sh-login-form-wrap">
            <div className="sh-login-mobile-logo">
              <div className="sh-login-mobile-logo-mark" aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 1.8 4.9 13a1 1 0 0 0 .8 1.6h5.1l-.9 7.6 9.2-12a1 1 0 0 0-.8-1.6h-5.1l1.1-6.1a.7.7 0 0 0-1.1-.7Z" /></svg></div>
              <div>SmartEnergy <span>Hub</span></div>
            </div>
            <h2>Bon retour parmi nous</h2>
            <p className="sh-login-subtitle">Connectez-vous pour accéder à votre espace de supervision.</p>

            <form onSubmit={submit}>
              <label className="sh-login-field">
                <span>Identifiant</span>
                <div className="sh-login-input-wrap">
                  <span className="sh-login-input-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg></span>
                  <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="Votre identifiant" required />
                </div>
              </label>

              <label className="sh-login-field">
                <span>Mot de passe</span>
                <div className="sh-login-input-wrap">
                  <span className="sh-login-input-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Votre mot de passe" required />
                </div>
              </label>

              {error && <div className="sh-login-error" role="alert">{error}</div>}

              <button className="sh-login-submit" type="submit" disabled={loading}>
                {loading ? 'Connexion en cours…' : 'Se connecter'}
                {!loading && <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
              </button>
            </form>

            <div className="sh-login-secure"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg> Connexion sécurisée à votre espace énergétique</div>
            <div className="sh-login-bottom">SmartEnergy Hub · Supervision, analyse et efficacité énergétique</div>
          </div>
        </div>
      </section>
    </main>
  );
}
