// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '@/hooks/useSync';

export default function TabsLayout() {
  // Semana 9: mientras haya sesión, la sincronización automática queda activa en todas las pestañas
  useSync();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#34d399',
        tabBarInactiveTintColor: '#a3a3a3',
        tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#262626' },
      }}
    >
      {/* SDK 58: el color del ícono llega como ColorValue; Ionicons lo pide como texto */}
      <Tabs.Screen
        name="geocam"
        options={{
          title: 'GeoCam',
          tabBarIcon: ({ color, size }) => <Ionicons name="camera" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="fotos"
        options={{
          title: 'Fotos',
          tabBarIcon: ({ color, size }) => <Ionicons name="images" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="nube"
        options={{
          title: 'Nube',
          tabBarIcon: ({ color, size }) => <Ionicons name="cloud" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}