import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatedSplashScreen } from '../components/AnimatedSplashScreen';
import { ThemedBackground } from '../components/ThemedBackground';
import { Colors } from '../constants/theme';
import { supabase } from '../supabase';
import ThemeProvider, { useTheme } from './theme';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav({ session, initializing }: { session: any, initializing: boolean }) {
  const segments = useSegments();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  const [fontsLoaded] = useFonts({
    'ClashGrotesk': require('../assets/fonts/ClashGrotesk-Regular.ttf'),
    'ClashGrotesk-Medium': require('../assets/fonts/ClashGrotesk-Medium.ttf'),
    'ClashGrotesk-SemiBold': require('../assets/fonts/ClashGrotesk-SemiBold.ttf'),
    'ClashGrotesk-Bold': require('../assets/fonts/ClashGrotesk-Bold.ttf'),
  });

  useEffect(() => {
    if (initializing || !fontsLoaded) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'signup';

    if (!session && !inAuthGroup) {
      // Not logged in and not on an auth screen -> go to login
      router.replace('/login');
    } else if (session && inAuthGroup) {
      // Logged in and on an auth screen -> go to home
      router.replace('/(tabs)');
    }

    // Hide native splash screen only when everything is ready
    SplashScreen.hideAsync();
  }, [session, initializing, segments, fontsLoaded]);

  if (initializing || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDarkMode ? Colors.dark.background : Colors.light.background }}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (showAnimatedSplash) {
    return <AnimatedSplashScreen onAnimationFinish={() => setShowAnimatedSplash(false)} />;
  }

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ThemedBackground style={{ flex: 1 }}>
        <Stack
          key={isDarkMode ? 'dark' : 'light'}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'fade', // Optional: smoother transitions over gradient
          }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="create-post" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemedBackground>
    </>
  );
}

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    async function initializeAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Session fetch error:", error.message);
          // If refresh token is invalid, clear everything
          if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
            await supabase.auth.signOut();
          }
        }
        setSession(session);
      } catch (err) {
        console.error("Auth init exception:", err);
      } finally {
        setInitializing(false);
      }
    }

    initializeAuth();

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