import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../types/navigation';
import { AppColors } from '../theme';
import { APP_METADATA } from '../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Home');
    }, 1800);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.brandingBox}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="video-wireless" size={54} color={AppColors.primary} />
        </View>

        <Text style={styles.systemTitle}>{APP_METADATA.appName}</Text>
        <Text style={styles.moduleTitle}>{APP_METADATA.moduleName}</Text>
        <Text style={styles.versionText}>Version {APP_METADATA.version}</Text>
      </View>

      <View style={styles.footer}>
        <ActivityIndicator animating color={AppColors.primary} size="small" />
        <Text style={styles.loadingText}>Initializing Wireless Camera Node...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  brandingBox: {
    alignItems: 'center',
    marginTop: 80,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.primary,
    marginBottom: 24,
  },
  systemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMuted,
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  moduleTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: AppColors.textPrimary,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 13,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: AppColors.textMuted,
    letterSpacing: 0.5,
  },
});
