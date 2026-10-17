// hooks/useUserId.ts — id del usuario con sesión iniciada (C5: cada consulta local se filtra por él)
import { useAuth } from '@/context/AuthContext';

/**
 * Solo se usa en pantallas protegidas por Stack.Protected, donde siempre hay sesión.
 * Si no la hay, es un error de navegación y se avisa con una excepción.
 */
export function useUserId(): string {
  const { session } = useAuth();
  if (!session) throw new Error('useUserId se usó sin sesión iniciada');
  return session.user.id;
}