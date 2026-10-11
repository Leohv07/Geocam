// app/_layout.tsx — layout raíz protegido por las migraciones (T2)
import '../global.css';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';

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
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}