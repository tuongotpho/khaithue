import type { KyKeKhai } from './types.js'

const hai = (n: number) => String(n).padStart(2, '0')

export function thangDau(ky: KyKeKhai) {
  return (ky.quy - 1) * 3 + 1
}

export function tuNgay(ky: KyKeKhai) {
  return `01/${hai(thangDau(ky))}/${ky.nam}`
}

export function denNgay(ky: KyKeKhai) {
  const thangCuoi = thangDau(ky) + 2
  const ngayCuoi = new Date(ky.nam, thangCuoi, 0).getDate()
  return `${ngayCuoi}/${hai(thangCuoi)}/${ky.nam}`
}

/** Hạn nộp tờ khai quý: ngày cuối cùng của tháng đầu quý sau */
export function hanNop(ky: KyKeKhai) {
  const thang = thangDau(ky) + 3 // tháng đầu quý sau (có thể = 13)
  const d = new Date(ky.nam, thang, 0)
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** dd/MM/yyyy có nằm trong quý không */
export function trongKy(ngay: string, ky: KyKeKhai): boolean {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(ngay.trim())
  if (!m) return false
  const thang = Number(m[2])
  return Number(m[3]) === ky.nam && thang >= thangDau(ky) && thang <= thangDau(ky) + 2
}

/** Quý vừa kết thúc tính từ ngày hôm nay — thường là quý cần khai */
export function quyCanKhai(homNay = new Date()): KyKeKhai {
  const q = Math.floor(homNay.getMonth() / 3) // quý hiện tại 0..3
  return q === 0 ? { quy: 4, nam: homNay.getFullYear() - 1 } : { quy: q as 1 | 2 | 3, nam: homNay.getFullYear() }
}

/** yyyy-MM-dd theo giờ máy */
export function ngayISO(d = new Date()) {
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`
}
