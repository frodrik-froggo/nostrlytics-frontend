import path from 'node:path';

import { partytownVite } from '@builder.io/partytown/utils';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    partytownVite({
      dest: path.join(__dirname, 'dist', '~partytown')
    }),
    visualizer({
      emitFile: true,
      filename: 'stats.html',
      template: 'sunburst'
    })
  ],
  resolve: {
    alias: [
      { find:  "@/components/", replacement: __dirname+"/src/@/components/" },
      { find:  "@/lib/", replacement: __dirname+"/src/@/lib/" }
    ]
  }
});
