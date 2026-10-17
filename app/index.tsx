// app/index.tsx — fuera de los grupos protegidos: redirige según la sesión
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? '/geocam' : '/login'} />;
}