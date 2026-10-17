// app/login.tsx — T2: registro e inicio de sesión con Supabase Auth
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (action: typeof signIn) => {
    if (!email.trim() || password.length < 6) {
      setMessage('Escribe tu correo y una contraseña de al menos 6 caracteres.');
      return;
    }
    setBusy(true);
    setMessage(await action(email, password)); // null si todo salió bien
    setBusy(false);
    // No hay router.replace: al cambiar la sesión, Stack.Protected cambia de pantalla solo
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 justify-center gap-4 bg-neutral-950 px-6"
    >
      <View className="mb-4 items-center gap-1">
        <Text className="text-4xl">📸🌎</Text>
        <Text className="text-3xl font-bold text-white">GeoCam</Text>
        <Text className="text-neutral-400">Inicia sesión para respaldar tus fotos en la nube</Text>
      </View>

      <TextInput
        className="rounded-xl bg-neutral-900 px-4 py-3 text-base text-white"
        placeholder="Correo"
        placeholderTextColor="#737373"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        className="rounded-xl bg-neutral-900 px-4 py-3 text-base text-white"
        placeholder="Contraseña (mínimo 6 caracteres)"
        placeholderTextColor="#737373"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />

      {message && <Text className="text-center text-red-400">{message}</Text>}

      <Pressable
        onPress={() => submit(signIn)}
        disabled={busy}
        className="items-center rounded-xl bg-emerald-500 p-4 active:opacity-80"
      >
        {busy ? <ActivityIndicator color="#0a0a0a" /> : <Text className="font-semibold text-neutral-950">Iniciar sesión</Text>}
      </Pressable>
      <Pressable onPress={() => submit(signUp)} disabled={busy} className="items-center p-3">
        <Text className="text-emerald-300">Crear cuenta</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}