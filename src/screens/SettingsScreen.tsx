import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, Switch, List, SegmentedButtons, TextInput } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Header } from '../components/Header';
import { useSettings } from '../hooks/useSettings';
import { useCamera } from '../hooks/useCamera';
import { AppColors } from '../theme';
import { APP_METADATA, DEFAULT_SETTINGS } from '../utils/constants';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { settings: appSettings, updateSettings } = useSettings();
  const { settings: cameraSettings, setFacing, setResolution } = useCamera();

  return (
    <View style={styles.container}>
      <Header title="Settings & Hardware" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={styles.section} elevation={2}>
          <Text style={styles.sectionHeader}>CAMERA CONFIGURATION</Text>

          <Text style={styles.label}>Active Camera Sensor</Text>
          <SegmentedButtons
            value={cameraSettings.facing}
            onValueChange={(val) => setFacing(val as 'back' | 'front')}
            buttons={[
              { value: 'back', label: 'Rear Camera' },
              { value: 'front', label: 'Front Camera' },
            ]}
            style={styles.segmented}
          />

          <Text style={styles.label}>Stream Resolution</Text>
          <SegmentedButtons
            value={cameraSettings.resolution}
            onValueChange={(val) => setResolution(val as any)}
            buttons={[
              { value: '480p', label: '480p SD' },
              { value: '720p', label: '720p HD' },
              { value: '1080p', label: '1080p FHD' },
            ]}
            style={styles.segmented}
          />
        </Surface>

        <Surface style={styles.section} elevation={2}>
          <Text style={styles.sectionHeader}>WEBSOCKET SERVER TARGET & DIRECTION</Text>

          <Text style={styles.label}>Server Host / IP Address</Text>
          <TextInput
            mode="outlined"
            value={appSettings.serverHost || DEFAULT_SETTINGS.serverHost}
            onChangeText={(val) => updateSettings({ serverHost: val })}
            placeholder={`e.g. ${DEFAULT_SETTINGS.serverHost} or domain.com`}
            outlineColor={AppColors.border}
            activeOutlineColor={AppColors.primary}
            textColor={AppColors.textPrimary}
            style={styles.textInput}
          />

          <View style={styles.rowTwoCol}>
            <View style={styles.flexCol}>
              <Text style={styles.label}>WebSocket Port (AI Server)</Text>
              <TextInput
                mode="outlined"
                value={String(appSettings.serverPort || DEFAULT_SETTINGS.serverPort)}
                onChangeText={(val) => updateSettings({ serverPort: parseInt(val, 10) || DEFAULT_SETTINGS.serverPort })}
                keyboardType="numeric"
                outlineColor={AppColors.border}
                activeOutlineColor={AppColors.primary}
                textColor={AppColors.textPrimary}
                style={styles.textInput}
              />
            </View>

            <View style={styles.flexCol}>
              <Text style={styles.label}>Protocol</Text>
              <SegmentedButtons
                value={appSettings.serverProtocol || 'ws'}
                onValueChange={(val) => updateSettings({ serverProtocol: val as 'ws' | 'wss' })}
                buttons={[
                  { value: 'ws', label: 'ws://' },
                  { value: 'wss', label: 'wss://' },
                ]}
                style={styles.segmentedSmall}
              />
            </View>
          </View>

          <Text style={styles.label}>Camera Direction / Lane Identity</Text>
          <SegmentedButtons
            value={appSettings.cameraDirection || 'NORTH'}
            onValueChange={(val) => updateSettings({ cameraDirection: val as any })}
            buttons={[
              { value: 'NORTH', label: 'NORTH' },
              { value: 'SOUTH', label: 'SOUTH' },
              { value: 'EAST', label: 'EAST' },
              { value: 'WEST', label: 'WEST' },
            ]}
            style={styles.segmented}
          />
        </Surface>

        <Surface style={styles.section} elevation={2}>
          <Text style={styles.sectionHeader}>NODE PREFERENCES</Text>

          <List.Item
            title="Auto Connect on Scan"
            description="Automatically connect when valid QR is scanned"
            titleStyle={styles.itemTitle}
            descriptionStyle={styles.itemDesc}
            right={() => (
              <Switch
                value={appSettings.autoConnect}
                onValueChange={(val) => updateSettings({ autoConnect: val })}
                color={AppColors.primary}
              />
            )}
          />

          <List.Item
            title="Developer / Debug Mode"
            description="Enable detailed socket message logs and simulated controls"
            titleStyle={styles.itemTitle}
            descriptionStyle={styles.itemDesc}
            right={() => (
              <Switch
                value={appSettings.debugMode}
                onValueChange={(val) => updateSettings({ debugMode: val })}
                color={AppColors.primary}
              />
            )}
          />

          <List.Item
            title="Keep Screen Awake"
            description="Prevent device sleep during live streaming"
            titleStyle={styles.itemTitle}
            descriptionStyle={styles.itemDesc}
            right={() => (
              <Switch
                value={appSettings.keepScreenOn}
                onValueChange={(val) => updateSettings({ keepScreenOn: val })}
                color={AppColors.primary}
              />
            )}
          />
        </Surface>

        <Surface style={styles.section} elevation={2}>
          <Text style={styles.sectionHeader}>SYSTEM INFORMATION</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Project Name</Text>
            <Text style={styles.infoVal}>{APP_METADATA.appName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Node Module</Text>
            <Text style={styles.infoVal}>{APP_METADATA.moduleName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Version</Text>
            <Text style={styles.infoVal}>{APP_METADATA.version}</Text>
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    gap: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
    letterSpacing: 1.2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textPrimary,
    marginTop: 4,
  },
  segmented: {
    marginVertical: 4,
  },
  itemTitle: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  itemDesc: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoKey: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  rowTwoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  flexCol: {
    flex: 1,
  },
  textInput: {
    backgroundColor: AppColors.background,
    fontSize: 13,
    height: 44,
  },
  segmentedSmall: {
    marginVertical: 4,
    height: 44,
  },
});
