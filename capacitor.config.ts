import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lectro.app',
  appName: 'Lectro',
  webDir: 'public',
  server: {
    // IMPORTANT: Replace with your actual production URL
    // e.g., url: 'https://lectro.yourdomain.com'
    url: 'https://lectroapp.duckdns.org',
    cleartext: true,
  },
};

export default config;
