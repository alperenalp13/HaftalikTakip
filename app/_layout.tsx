import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useSegments, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AuthWrapper() {
  const colorScheme = useColorScheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // This useEffect handles redirection based on authentication state
  useEffect(() => {
    if (!loading) {
      const inAuthGroup = segments[0] === 'auth';

      if (
        // If the user is not signed in and the initial segment is not in the auth group
        !user &&
        !inAuthGroup
      ) {
        // Redirect to the auth screen
        router.replace('/auth');
      } else if (user && inAuthGroup) {
        // If the user is signed in and the initial segment is in the auth group
        // Redirect away from the auth screen to the main app
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen name="auth/index" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
}
