// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'three': 'three',
      'three/addons/': 'three/examples/jsm/',
      'talkinghead': 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.3/modules/talkinghead.mjs'
    }
  },
  optimizeDeps: {
    include: ['three'],
    exclude: ['talkinghead']
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'react', 
            'react-dom'
          ],
          ui: [
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-progress',
            '@radix-ui/react-select',
            '@radix-ui/react-separator', 
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            'react-icons',
            'lucide-react',
            'clsx',
            'class-variance-authority',
            'tailwind-merge',
            'tailwindcss-animate'
          ],
          three: ['three'],
          xlsx: ['xlsx'],
          state: ['zustand']
        }
      }
    }
  },
  server: {
    open: true,
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: true,
        secure: false
      },
      '/content': {
        target: 'http://localhost:3010',
        changeOrigin: true,
        secure: false
      },
      '/static-content': {
        target: 'http://localhost:3010',
        changeOrigin: true,
        secure: false
      }
    }
  }
});