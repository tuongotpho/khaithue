// Kết nối Firebase — project app-from-ai, database Firestore "khaithue", bucket Storage "khaithue".
// Thông số dưới đây là loại được phép công khai (nằm trong mọi trang web dùng Firebase);
// an toàn nằm ở LUẬT PHÂN QUYỀN (firebase/*.rules): mỗi tài khoản chỉ đọc/ghi vùng của chính mình.
// Không dùng Analytics: app thuế không cần theo dõi người dùng.

import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

/** Chạy với máy giả lập (npm run dev:gia-lap) — không đụng dữ liệu thật */
const GIA_LAP = import.meta.env.VITE_GIA_LAP === '1'

const cauHinh = {
  apiKey: 'AIzaSyCfCX-xKHVnvv2tEb_AVdxL_xvqnnSjgcQ',
  authDomain: 'app-from-ai.firebaseapp.com',
  projectId: GIA_LAP ? 'demo-khaithue' : 'app-from-ai',
  storageBucket: 'khaithue',
  messagingSenderId: '895767442095',
  appId: '1:895767442095:web:4d776f22145dd356259a5a',
}

/** Đăng nhập Google chỉ chạy trên trang web (http/https), không chạy khi mở file .html trực tiếp */
export const coMay = typeof location !== 'undefined' && /^https?:$/.test(location.protocol)

const app = initializeApp(cauHinh)
export const auth = getAuth(app)
export const db = getFirestore(app, 'khaithue')
export const luuTru = getStorage(app, 'gs://khaithue')

if (GIA_LAP) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', Number(import.meta.env.VITE_CONG_FIRESTORE_GIA_LAP) || 8080)
  connectStorageEmulator(luuTru, '127.0.0.1', 9199)
  // CHỈ máy giả lập: đăng nhập bằng tài khoản Google giả để thử (bản build thật không có đoạn này)
  if (typeof window !== 'undefined') (window as unknown as { __dangNhapThu: (email: string) => Promise<unknown> }).__dangNhapThu = async (email: string) => {
    const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth')
    return signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })))
  }
}
