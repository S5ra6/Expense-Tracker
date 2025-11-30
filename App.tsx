import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider, useTheme } from 'react-native-paper';
import { useFonts, Poppins_300Light, Poppins_400Regular, Poppins_500Medium } from '@expo-google-fonts/poppins';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator from './navigation/AppNavigator';
import { AppProvider, useAppContext } from './context/AppContext';
import { getAppTheme } from './theme/theme';
import { setupNotifications } from './services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore */
});

type HydrationGateProps = {
  children?: React.ReactNode;
};

const HydrationGate = ({ children }: HydrationGateProps) => {
  const { isHydrated } = useAppContext();
  const theme = useTheme();

  if (!isHydrated) {
    return (
      <View style={[styles.hydrationContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
};

const ThemeBridge = ({ children }: { children: React.ReactNode }) => {
  const {
    state: { themePreference },
  } = useAppContext();
  const systemScheme = useColorScheme();

  const resolvedMode = useMemo<'light' | 'dark'>(() => {
    if (themePreference === 'system') {
      return systemScheme === 'light' ? 'light' : 'dark';
    }
    return themePreference;
  }, [systemScheme, themePreference]);

  const theme = useMemo(() => getAppTheme(resolvedMode), [resolvedMode]);
  const statusBarStyle = theme.dark ? 'light' : 'dark';

  return (
    <PaperProvider theme={theme}>
      <StatusBar style={statusBarStyle} backgroundColor="transparent" />
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        {children}
      </View>
    </PaperProvider>
  );
};

const RootApp = () => {
  const [fontsLoaded] = useFonts({
    'Poppins-Light': Poppins_300Light,
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {
        /* ignore */
      });
    }
  }, [fontsLoaded]);

  useEffect(() => {
    setupNotifications().catch((error) => {
      console.warn('Failed to initialize notifications', error);
    });
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <AppProvider>
        <ThemeBridge>
          <HydrationGate>
            <AppNavigator />
          </HydrationGate>
        </ThemeBridge>
      </AppProvider>
    </GestureHandlerRootView>
  );
};

export default RootApp;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hydrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
