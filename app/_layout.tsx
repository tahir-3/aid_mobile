import '../global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSyncStore } from '../store/syncStore';
import { ActivityIndicator, I18nManager } from 'react-native';

// Screens are mirrored by hand (flex-row-reverse, text-right), so the layout must stay LTR.
// Without this an Arabic-language device flips everything back to left-to-right.
// app.json also sets expo-localization `supportsRTL: false` (native side, needs a rebuild).
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const { isAuthenticated, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initialize();
      setIsReady(true);
    };
    init();
  }, [initialize]);

  // Signed in: finish a first download that was interrupted (app killed / offline).
  // Signed out: forget the previous user's sync progress.
  useEffect(() => {
    if (!isReady) return;
    if (isAuthenticated) {
      useSyncStore.getState().resumeIfIncomplete();
      // Roles/permissions may have changed since the profile was cached.
      useAuthStore.getState().refreshProfile();
    } else useSyncStore.getState().reset();
  }, [isAuthenticated, isReady]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to the login page if the user is not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to the home page if the user is authenticated and on the login page
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, router, isReady]);

  if (!isReady) {
    return <ActivityIndicator color={'#143A6B'} size={40} />; // Or a splash screen / loading spinner
  }

  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="recipient-details" options={{ headerShown: false }} />
        <Stack.Screen name="aid-details" options={{ headerShown: false }} />
        <Stack.Screen name="new-aid" options={{ headerShown: false }} />
        <Stack.Screen name="new-recipient" options={{ headerShown: false }} />
        <Stack.Screen name="record-details" options={{ headerShown: false }} />
        <Stack.Screen name="new-record" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
