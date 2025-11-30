// src/theme.ts
import { lightTheme, type ThemeVars } from '@mysten/dapp-kit';

export const darkTheme: ThemeVars = {
  ...lightTheme,
  backgroundColors: {
    ...lightTheme.backgroundColors,

    // Main button & modal
    primaryButton: '#1f2937',        // bg-slate-800
    primaryButtonHover: '#111827',   // bg-slate-900
    outlineButtonHover: '#0f172a',
    modalOverlay: 'rgba(15, 23, 42, 0.75)', // darker overlay
    modalPrimary: '#020617',         // bg-slate-950
    modalSecondary: '#020617',

    // 🔹 IMPORTANT PART: ConnectButton dropdown/accordion
    dropdownMenu: '#020617',         // accordion background
    dropdownMenuSeparator: '#111827',

    // Icon & wallet item states
    iconButton: 'transparent',
    iconButtonHover: '#111827',
    walletItemHover: '#111827',
    walletItemSelected: '#020617',
  },
  borderColors: {
    outlineButton: '#1f2937',
  },
  colors: {
    ...lightTheme.colors,
    primaryButton: '#e5e7eb',        // text-slate-200
    outlineButton: '#e5e7eb',
    iconButton: '#e5e7eb',
    body: '#e5e7eb',
    bodyMuted: '#9ca3af',
    bodyDanger: '#f97316',
  },
  shadows: {
    ...lightTheme.shadows,
    primaryButton: '0px 4px 16px rgba(15, 23, 42, 0.7)',
    walletItemSelected: '0px 2px 10px rgba(15, 23, 42, 0.8)',
  },
};
