// Lưu sổ theo dõi trên chính máy này (localStorage).
// MỖI TÀI KHOẢN MỘT NGĂN RIÊNG: chưa đăng nhập dùng ngăn "khách"; đăng nhập thì dùng ngăn theo uid.
// Nhờ vậy máy dùng chung không lộ hồ sơ của người trước cho người sau.
// Mất dữ liệu (xoá lịch sử trình duyệt...) thì đăng nhập lại (tải từ mây) hoặc kéo lại các file XML cũ.

import { khoTrong, type Kho } from './core/kho'
import type { HoSoDN } from './core/types'

const khoa = (chu: string | null) => (chu ? `kho:v1:${chu}` : 'kho:v1')

export function docKho(chu: string | null = null): Kho {
  try {
    const s = localStorage.getItem(khoa(chu))
    if (s) return JSON.parse(s) as Kho
    // Chuyển từ bản cũ (chỉ lưu 1 công ty) vào ngăn khách
    const cu = !chu && localStorage.getItem('hoSo')
    if (cu) {
      const hoSo = JSON.parse(cu) as HoSoDN
      return { ...khoTrong(), chon: hoSo.mst, congTy: { [hoSo.mst]: { hoSo, kyNguon: '', suaTay: true } } }
    }
  } catch {
    /* bỏ qua */
  }
  return khoTrong()
}

export function luuKho(kho: Kho, chu: string | null = null) {
  try {
    localStorage.setItem(khoa(chu), JSON.stringify(kho))
  } catch {
    /* bỏ qua */
  }
}

/** Xoá ngăn khách (sau khi đã đưa vào tài khoản) */
export function xoaKhoKhach() {
  try {
    localStorage.removeItem(khoa(null))
    localStorage.removeItem('hoSo')
  } catch {
    /* bỏ qua */
  }
}

/** Xoá bản sao trên máy của một tài khoản (khi đăng xuất) */
export function xoaKhoCua(chu: string) {
  try {
    localStorage.removeItem(khoa(chu))
  } catch {
    /* bỏ qua */
  }
}
