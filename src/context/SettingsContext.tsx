import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../utils/constants';
import { StorageService } from '../utils/storage';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  addServerToHistory: (serverIp: string) => Promise<void>;
  resetSettings: () => Promise<void>;
  isLoading: boolean;
}

export const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  addServerToHistory: async () => {},
  resetSettings: async () => {},
  isLoading: true,
});

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await StorageService.getItem<AppSettings>(
      STORAGE_KEYS.APP_SETTINGS,
      DEFAULT_SETTINGS
    );
    setSettings(loaded);
    setIsLoading(false);
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await StorageService.setItem(STORAGE_KEYS.APP_SETTINGS, updated);
  };

  const addServerToHistory = async (serverIp: string) => {
    const history = settings.serverHistory || [];
    if (!history.includes(serverIp)) {
      const updatedHistory = [serverIp, ...history].slice(0, 5);
      await updateSettings({ serverHistory: updatedHistory });
    }
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    await StorageService.setItem(STORAGE_KEYS.APP_SETTINGS, DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, addServerToHistory, resetSettings, isLoading }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
