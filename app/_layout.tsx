import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '../supabase';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { 
  useFonts, 
  Montserrat_400Regular, 
  Montserrat_500Medium, 
  Montserrat_600SemiBold, 
  Montserrat_700Bold 
} from '@expo-google-fonts/montserrat';
import ThemeProvider, { useTheme } from './theme';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav({ session, initializing }: { session: any, initializing: boolean }) {
  const segments = useSegments();
  const router = useRouter();
  const { isDarkMode } = useTheme();

  const [fontsLoaded] = useFonts({
    'Montserrat': Montserrat_400Regular,
    'Montserrat-Medium': Montserrat_500Medium,
    'Montserrat-SemiBold': Montserrat_600SemiBold,
    'Montserrat-Bold': Montserrat_700Bold,
  });

  useEffect(() => {
    if (initializing || !fontsLoaded) return;

    // FIX: Add 'signup' here so the layout doesn't kick you back to login
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
    
    SplashScreen.hideAsync();
  }, [session, initializing, segments, fontsLoaded]);

  if (initializing || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? '#121212' : '#fff' }}>
        <ActivityIndicator size="large" color="#FF6719" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack
        key={isDarkMode ? 'dark' : 'light'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDarkMode ? '#121212' : '#fff' },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create-post" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitializing(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutNav session={session} initializing={initializing} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}