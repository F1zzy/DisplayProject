import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSettings } from '../api/client';

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  location: process.env.REACT_APP_LOCATION || 'Nottingham',
  stockSymbols: ['AAPL', 'GOOGL', 'MSFT'],
  widgetRotationMs: 120000,
  enabledWidgets: ['stock', 'news', 'timetable', 'network', 'sky', 'spotify', 'f1'],
  calendarDays: 1,
  newsGeneral: true,
  newsTechnology: true,
  forecastDays: 3,
  backgroundMode: 'default',
  backgroundColor: '#101115',
  backgroundImage: '',
  colorScheme: 'orange-dark',
  fontPreset: 'nothing',
  sectionOrder: ['header', 'weather', 'widgets'],
  clockSide: 'left',
  density: 'comfortable',
  clockAnimation: 'off',
  weatherAtmosphere: false,
  nightFocusMode: false,
  nightFocusWhen: 'auto',
  nightFocusStartHour: 20,
  nightFocusEndHour: 6,
  displayBrightness: 100,
  spotifyLyricsBackground: true,
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const applySettings = useCallback((next) => {
    if (!next || typeof next !== 'object') return;
    setSettings((prev) => ({
      ...DEFAULT_SETTINGS,
      ...prev,
      ...next,
      stockSymbols: Array.isArray(next.stockSymbols)
        ? next.stockSymbols
        : prev.stockSymbols,
      enabledWidgets: Array.isArray(next.enabledWidgets)
        ? next.enabledWidgets
        : prev.enabledWidgets,
      sectionOrder: Array.isArray(next.sectionOrder)
        ? next.sectionOrder
        : prev.sectionOrder,
    }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await getSettings();
      applySettings(data);
      setError(null);
    } catch (err) {
      console.error('Settings load failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, loading, error, applySettings, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

export { DEFAULT_SETTINGS };
