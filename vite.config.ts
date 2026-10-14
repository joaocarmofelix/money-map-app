import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the same build works on GitHub Pages (/moneymap/) or any host root.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,mjs}'], maximumFileSizeToCacheInBytes: 6_000_000 },
      manifest: {
        name: 'MoneyMap',
        short_name: 'MoneyMap',
        description: 'Para onde vai o teu dinheiro, a partir dos extratos do banco.',
        lang: 'pt-PT',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#e9eeec',
        theme_color: '#1d6a66',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Adicionar gasto', short_name: 'Gasto', url: './?add=1', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Importar extrato', short_name: 'Importar', url: './?tab=importar', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
      },
    }),
  ],
});
