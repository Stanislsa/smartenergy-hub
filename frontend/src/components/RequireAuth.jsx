import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';

export default function RequireAuth({ children }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { error, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: api.me,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    const onLogout = () => queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [queryClient]);

  if (isLoading) return <div style={{ padding: 32 }}>Chargement…</div>;
  if (error?.status === 401) return <Navigate to="/login" replace state={{ from: location }} />;
  // 404 = authentification désactivée côté serveur : on laisse passer
  return children;
}