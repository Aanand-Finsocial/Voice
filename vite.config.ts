import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';


export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/text-to-speech': {
        target: 'https://texttospeech.codewizzz.com',
        changeOrigin: true,
        secure: false,
      },
      '/response-status': {
        target: 'https://hindai.codewizzz.com/chat',
        changeOrigin: true,
        secure: false,
      },
      '/initiate': {
        target: 'https://hindai.codewizzz.com/chat',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  
});
