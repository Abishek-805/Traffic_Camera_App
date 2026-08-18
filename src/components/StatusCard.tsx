import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppColors } from '../theme';

interface StatusCardProps {
  server?: string;
  port?: number;
  cameraId?: string;
  assignedLane?: string;
  pingMs?: number;
  fps?: number;
  connectionState: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  server = 'Not Connected',
  port = 8000,
  cameraId = 'CAM-001',
  assignedLane = 'Unassigned',
  pingMs = 0,
  fps = 0,
  connectionState,
}) => {
  return (
    <Surface style={styles.card} elevation={3}>
      <View style={styles.headerRow}>
        <View style={styles.nodeBadge}>
          <MaterialCommunityIcons name="remote-desktop" size={18} color={AppColors.primary} />
          <Text style={styles.nodeIdText}>{cameraId}</Text>
        </View>
        <Text style={styles.laneText}>{assignedLane}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.label}>SERVER ADDRESS</Text>
          <Text style={styles.value} numberOfLines={1}>
            {server === 'Not Connected' ? 'No Active Connection' : `${server}:${port}`}
          </Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.label}>STATE</Text>
          <Text style={[styles.value, { color: AppColors.primary }]}>{connectionState}</Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.label}>LATENCY</Text>
          <Text style={styles.value}>{pingMs > 0 ? `${pingMs} ms` : '--'}</Text>
        </View>

        <View style={styles.gridItem}>
          <Text style={styles.label}>CAMERA FPS</Text>
          <Text style={styles.value}>{fps > 0 ? `${fps} FPS` : '0 FPS'}</Text>
        </View>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  nodeIdText: {
    color: AppColors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  laneText: {
    color: AppColors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
    marginVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  gridItem: {
    width: '50%',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
});
