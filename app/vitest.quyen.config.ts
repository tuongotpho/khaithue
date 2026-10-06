import { defineConfig } from 'vitest/config'
// Máy đang có máy giả lập khác chiếm cổng 8080: đặt CONG_FIRESTORE_GIA_LAP=<cổng khác> (và chạy emulator ở cổng đó).

// Test chạy trên máy giả lập Firebase (npm run test:quyen): luật phân quyền + đồng bộ
export default defineConfig({
  test: { include: ['firebase-tests/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000, env: { VITE_GIA_LAP: '1', VITE_CONG_FIRESTORE_GIA_LAP: process.env.CONG_FIRESTORE_GIA_LAP ?? '8080' }, fileParallelism: false },
})
