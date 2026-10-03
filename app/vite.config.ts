import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Header bảo mật lấy từ vercel.json để `npm run preview` trên máy chạy y như trên Vercel.
// CHỈ dùng cho xem trước trên máy: lúc build trên Vercel, file vercel.json bị Vercel xử lý lại
// (không còn "headers") -> đọc không được thì bỏ qua, không được làm hỏng build.
function docHeaderVercel(): Record<string, string> {
  try {
    const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
    const ds: { key: string; value: string }[] = v?.headers?.[0]?.headers ?? []
    return Object.fromEntries(ds.map((h) => [h.key, h.value]))
  } catch {
    return {}
  }
}
const headers = docHeaderVercel()

// Build ra MỘT file index.html duy nhất: mở bằng trình duyệt là chạy, không cần mạng
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: './',
  preview: { headers },
  // Test thường chỉ trong src/. Test cần máy giả lập Firebase (firebase-tests/) chạy riêng: npm run test:quyen
  // Bài đối chiếu hồ sơ thật đọc vài trăm file trong OneDrive: cho dư thời gian
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000 },
})
