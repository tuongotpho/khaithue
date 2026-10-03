import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Header bảo mật lấy đúng từ vercel.json -> `npm run preview` chạy y như trên Vercel
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const headers: Record<string, string> = Object.fromEntries(vercel.headers[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]))

// Build ra MỘT file index.html duy nhất: mở bằng trình duyệt là chạy, không cần mạng
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: './',
  preview: { headers },
  // Test thường chỉ trong src/. Test cần máy giả lập Firebase (firebase-tests/) chạy riêng: npm run test:quyen
  test: { include: ['src/**/*.test.ts'] },
})
