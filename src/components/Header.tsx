import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useConnection } from '../hooks/useConnection';
import { AppColors } from '../theme';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Traffic Camera Node',
  showBack = false,
  onBack,
  onOpenSettings,
}) => {
  const { connectionState } = useConnection();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'STREAMING':
        return AppColors.streaming;
      case 'WAITING':
      case 'REGISTERED':
        return AppColors.waiting;
      case 'CONNECTING':
      case 'SCANNING':
        return AppColors.primary;
      case 'DISCONNECTED':
      case 'ERROR':
      default:
        return AppColors.disconnected;
    }
  };

  return (
    <Surface style={styles.container} elevation={2}>
      <View style={styles.leftRow}>
        {showBack ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onBack}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={AppColors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <MaterialCommunityIcons name="video-wireless" size={26} color={AppColors.primary} />
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.rightRow}>
        <View style={styles.badge}>
          <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
          <Text style={[styles.badgeText, { color: getStatusColor() }]}>
            {connectionState}
          </Text>
        </View>

        {onOpenSettings && (
          <TouchableOpacity style={styles.iconBtn} onPress={onOpenSettings}>
            <MaterialCommunityIcons name="cog" size={24} color={AppColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: AppColors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
    letterSpacing: 0.5,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  iconBtn: {
    padding: 6,
  },
});
