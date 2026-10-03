// Lưu sổ theo dõi trên chính máy này (localStorage) — không gửi đi đâu.
// Mất dữ liệu (xoá lịch sử trình duyệt...) thì chỉ cần kéo lại các file XML tờ khai cũ.

import { khoTrong, type Kho } from './core/kho'
import type { HoSoDN } from './core/types'

const KHOA = 'kho:v1'

export function docKho(): Kho {
  try {
    const s = localStorage.getItem(KHOA)
    if (s) return JSON.parse(s) as Kho
    // Chuyển từ bản cũ (chỉ lưu 1 công ty)
    const cu = localStorage.getItem('hoSo')
    if (cu) {
      const hoSo = JSON.parse(cu) as HoSoDN
      return { ...khoTrong(), chon: hoSo.mst, congTy: { [hoSo.mst]: { hoSo, kyNguon: '', suaTay: true } } }
    }
  } catch {
    /* bỏ qua */
  }
  return khoTrong()
}

export function luuKho(kho: Kho) {
  try {
    localStorage.setItem(KHOA, JSON.stringify(kho))
  } catch {
    /* bỏ qua */
  }
}
