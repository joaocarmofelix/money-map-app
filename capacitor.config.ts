import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pt.moneymap.app',
  appName: 'MoneyMap',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Edge to edge: the app pads itself with env(safe-area-inset-*) (viewport-fit=cover in index.html).
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_moneymap',
      iconColor: '#2547d0',
    },
  },
};

export default config;
