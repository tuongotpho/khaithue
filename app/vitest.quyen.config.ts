import { defineConfig } from 'vitest/config'

// Test chạy trên máy giả lập Firebase (npm run test:quyen): luật phân quyền + đồng bộ
export default defineConfig({
  test: { include: ['firebase-tests/**/*.test.ts'], testTimeout: 30000, hookTimeout: 60000, env: { VITE_GIA_LAP: '1' }, fileParallelism: false },
})
