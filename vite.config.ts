import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      // O limite padrão é 500 kB. Firebase (auth+firestore) e jsPDF/html2canvas
      // são bibliotecas intrinsecamente grandes, porém agora vivem em chunks
      // próprios e cacheados (firebase) ou são carregados sob demanda (pdf).
      // Ajustamos o limite para não gerar aviso falso para eles.
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          // Separa as bibliotecas grandes em chunks próprios, para o navegador
          // poder usar cache entre deploys e evitar um bundle único gigante.
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('firebase')) return 'firebase';
            if (id.includes('recharts') || id.includes('d3-') || id.includes('decimal.js') || id.includes('victory')) return 'charts';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg') || id.includes('@babel')) return 'pdf';
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler') || id.includes('loose-envify') || id.includes('js-tokens') || id.includes('motion') || id.includes('framer-motion')) return 'react';
            if (id.includes('lucide')) return 'icons';
          },
        },
      },
    },
  };
});
