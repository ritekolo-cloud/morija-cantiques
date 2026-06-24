import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

interface SettingsState {
  theme: Theme;
  fontSize: FontSize;
  language: string;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      fontSize: 'medium',
      language: 'fr',
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLanguage: (language) => set({ language }),
    }),
    { name: 'morija-settings' }
  )
);
