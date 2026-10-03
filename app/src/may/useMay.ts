import { useEffect, useState } from 'react'
import { getRedirectResult, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth, coMay } from './firebase'

/** Trạng thái đăng nhập Google */
export function useNguoiDung() {
  const [user, setUser] = useState<User | null>(null)
  const [dangTai, setDangTai] = useState(coMay)
  const [loi, setLoi] = useState('')
  useEffect(() => {
    if (!coMay) return
    // Quay về sau khi đăng nhập kiểu chuyển trang: lấy kết quả, có lỗi thì báo
    getRedirectResult(auth).catch((e) => setLoi(`Đăng nhập không được: ${(e as Error).message}`))
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setDangTai(false)
    })
  }, [])
  return { user, dangTai, loi }
}

// Trình duyệt chặn cửa sổ bật lên (điện thoại, trình duyệt trong Zalo...) thì chuyển sang kiểu chuyển trang
const LOI_CUA_SO = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported']

export async function dangNhap() {
  const nhaCC = new GoogleAuthProvider()
  nhaCC.setCustomParameters({ prompt: 'select_account' })
  if (import.meta.env.VITE_GIA_LAP === '1') return signInWithRedirect(auth, nhaCC)
  try {
    await signInWithPopup(auth, nhaCC)
  } catch (e) {
    if (e instanceof FirebaseError && LOI_CUA_SO.includes(e.code)) return signInWithRedirect(auth, nhaCC)
    if (e instanceof FirebaseError && e.code === 'auth/popup-closed-by-user') return
    throw e
  }
}

export async function dangXuat() {
  await signOut(auth)
}
