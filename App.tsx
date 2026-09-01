import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';

import { CustomDarkTheme } from './src/theme';
import { SettingsProvider } from './src/context/SettingsContext';
import { ConnectionProvider } from './src/context/ConnectionContext';
import { CameraProvider } from './src/context/CameraContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';

export default function App() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={CustomDarkTheme}>
          <SettingsProvider>
            <ConnectionProvider>
              <CameraProvider>
                <NavigationContainer theme={CustomDarkTheme as any}>
                  <StatusBar style="light" />
                  <AppNavigator />
                </NavigationContainer>
              </CameraProvider>
            </ConnectionProvider>
          </SettingsProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
