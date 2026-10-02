// app/index.tsx — la app abre directamente en la pestaña GeoCam
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/geocam" />;
}
