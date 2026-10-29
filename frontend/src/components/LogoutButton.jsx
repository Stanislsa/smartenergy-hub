import { LogOut } from 'lucide-react';
import { clearSession, getSession } from '../auth/auth';

export default function LogoutButton() {
  const session = getSession();
  if (!session) return null; // sécurité désactivée ou non connecté
  return (
    <button
      type="button"
      onClick={clearSession}
      aria-label="Se déconnecter"
      title={`Connecté : ${session.username} (${session.role})`}
      style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
    >
      <LogOut size={16} /> {session.username}
    </button>
  );
}