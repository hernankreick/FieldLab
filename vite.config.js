import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // MediaPipe usa WASM y módulos CJS que Vite no puede pre-bundlear correctamente
  optimizeDeps: {
    exclude: ['@mediapipe/pose', '@mediapipe/camera_utils', '@mediapipe/drawing_utils'],
  },
});
