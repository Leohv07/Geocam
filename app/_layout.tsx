// app/_layout.tsx — primero las migraciones locales (Semana 7), después la autenticación (Semana 8)
import '../global.css';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const userId = session?.user.id;

  // T4 + C5: al iniciar sesión, las fotos antiguas reciben clientId/updatedAt y las fotos sin dueño pasan a este usuario
  useEffect(() => {
    if (userId) void photosRepo.ensureSyncFields(userId);
  }, [userId]);

  // Mientras se lee la sesión guardada en SecureStore
  if (isLoading) return <View className="flex-1 bg-neutral-950" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* T2: sin sesión, estas pantallas no existen para el navegador */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="foto/[id]" options={{ headerShown: true, title: 'Foto' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  // Aplica solo las migraciones pendientes y registra cuáles ya corrió
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View className="flex-1 justify-center bg-neutral-950 p-6">
        <Text className="text-white">Error al preparar la base de datos: {error.message}</Text>
      </View>
    );
  }

  // Ninguna pantalla se monta antes de que la base esté migrada
  if (!success) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <ActivityIndicator color="#34d399" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}