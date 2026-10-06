// Đọc file Excel "DANH SÁCH HÓA ĐƠN" tải từ cổng hoá đơn điện tử.
// Hàm nhận vào mảng các dòng (mỗi dòng là mảng ô) để chạy được cả trên trình duyệt lẫn trong test.

import type { CanhBao, HoaDon, KyKeKhai, LoaiHD } from './types.js'
import { trongKy } from './ky.js'

type O = string | number | boolean | null | undefined

const chuan = (s: O) => String(s ?? '').trim()

/** MST bị Excel đổi thành số thì mất số 0 đầu (0100000000 -> 100000000): bù lại */
function mst(v: O): string {
  const s = chuan(v)
  return typeof v === 'number' && s.length < 10 ? s.padStart(10, '0') : s
}

/** Ngày lập: giữ dd/MM/yyyy. Nếu ô Excel là kiểu ngày (số sê-ri) thì đổi về dd/MM/yyyy */
export function ngayLap(v: O): string {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000)
    const hai = (n: number) => String(n).padStart(2, '0')
    return `${hai(d.getUTCDate())}/${hai(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
  }
  return chuan(v)
}

/** Đổi ô tiền thành số. Ô trống (hoá đơn bị thay thế/huỷ) = 0 */
export function soTien(v: O): number {
  if (typeof v === 'number') return Math.round(v)
  const s = chuan(v)
  if (!s) return 0
  const am = s.startsWith('-')
  const chiSo = s.replace(/[^\d]/g, '')
  if (!chiSo) return 0
  return am ? -Number(chiSo) : Number(chiSo)
}

/** Tìm cột theo tên tiêu đề (so khớp đầu chuỗi) */
function timCot(tieuDe: string[], ...ten: string[]): number {
  for (const t of ten) {
    const i = tieuDe.findIndex((h) => h.toLowerCase().startsWith(t.toLowerCase()))
    if (i >= 0) return i
  }
  return -1
}

/** Một file Excel đã đọc, CHƯA biết hoá đơn nào là bán ra / mua vào */
export interface TepHoaDon {
  ten: string
  hoaDon: HoaDon[] // loai tạm, phanLoai() sẽ gán lại
  /** Gợi ý theo tiêu đề cột — chỉ dùng khi MST không đủ để phân biệt */
  goiY: LoaiHD | null
  /** Kỳ tải về ghi trên đầu file: "Từ ngày tu đến ngày den" (dd/MM/yyyy) */
  tu?: string
  den?: string
  /** Số dòng lệch cột đã tự sửa (file ghép tay từ nhiều lần tải) */
  suaLechCot?: number
  /** Số dòng bị bỏ vì số tiền vô lý (không tự sửa được) */
  boDong?: number
}

/** Đọc một sheet "DANH SÁCH HÓA ĐƠN". Không phải danh sách hoá đơn thì trả null. */
export function docTep(rows: O[][], tenFile: string): TepHoaDon | null {
  const iTieuDe = rows.findIndex((r) => chuan(r?.[0]) === 'STT' && r.some((c) => chuan(c) === 'Số hóa đơn'))
  if (iTieuDe < 0) return null
  const td = rows[iTieuDe].map(chuan)
  const c = {
    mau: timCot(td, 'Ký hiệu mẫu số'),
    kh: timCot(td, 'Ký hiệu hóa đơn'),
    so: timCot(td, 'Số hóa đơn'),
    ngay: timCot(td, 'Ngày lập'),
    mstBan: timCot(td, 'MST người bán'),
    tenBan: timCot(td, 'Tên người bán'),
    dcBan: timCot(td, 'Địa chỉ người bán'),
    mstMua: timCot(td, 'MST người mua'),
    tenMua: timCot(td, 'Tên người mua'),
    dcMua: timCot(td, 'Địa chỉ người mua'),
    chuaThue: timCot(td, 'Tổng tiền chưa thuế'),
    thue: timCot(td, 'Tổng tiền thuế'),
    tt: timCot(td, 'Trạng thái hóa đơn'),
  }
  const o = (r: O[], i: number) => (i >= 0 ? chuan(r[i]) : '')

  // Gợi ý theo tiêu đề: file bán ra có "Địa chỉ người mua", file mua vào có "Địa chỉ người bán"
  // (bản tải về năm 2026 có cả hai cột nên gợi ý = null, phải dựa vào MST)
  const goiY: LoaiHD | null = c.dcMua >= 0 && c.dcBan < 0 ? 'ban' : c.dcBan >= 0 && c.dcMua < 0 ? 'mua' : null

  // Ô chứa MST (chuỗi 10/13 chữ số) — nếu nằm ở cột tiền thì dòng đó bị lệch cột
  const laMST = (v: O) => typeof v === 'string' && /^\d{10}(\d{3})?$/.test(v.trim())
  const laTien = (v: O) => typeof v === 'number' || (typeof v === 'string' && /^-?[\d.,]+$/.test(v.trim()) && !laMST(v))
  let suaLechCot = 0
  let boDong = 0

  const hoaDon: HoaDon[] = []
  for (const r of rows.slice(iTieuDe + 1)) {
    if (!r || (typeof r[0] !== 'number' && !/^\d+$/.test(chuan(r[0])))) continue
    // File GHÉP TAY từ nhiều lần tải: dòng dán từ bản tải có thêm cột "MST người mua" chèn ngay trước cột tiền
    // -> ô "Tổng tiền chưa thuế" lại chứa MST. Tự đọc lùi một cột cho các cột từ đó trở đi.
    const d = c.chuaThue >= 0 && laMST(r[c.chuaThue]) && laTien(r[c.chuaThue + 1]) ? 1 : 0
    const at = (i: number) => (i >= 0 && d && i >= c.chuaThue ? i + d : i)
    // Trạng thái: bản tải khác nhau thêm/bớt cột khác nhau -> tìm ô "Hóa đơn ..." quanh vị trí dự kiến
    const trangThai = d && c.tt >= 0 ? ([c.tt, c.tt + 1, c.tt - 1].map((i) => o(r, i)).find((x) => /^hóa đơn/i.test(x)) ?? o(r, c.tt)) : o(r, c.tt)
    const chuaThue = soTien(r[at(c.chuaThue)])
    const thue = soTien(r[at(c.thue)])
    // Lưới an toàn: tiền là MST, hoặc thuế > 10,5% giá trị -> không phải dòng hoá đơn hợp lệ, bỏ và báo
    if (laMST(r[at(c.chuaThue)]) || (chuaThue > 0 && thue > chuaThue * 0.105 + 10)) {
      boDong++
      continue
    }
    if (d) suaLechCot++
    hoaDon.push({
      loai: 'ban',
      kyHieuMau: o(r, c.mau),
      kyHieu: o(r, c.kh),
      so: o(r, c.so),
      ngay: ngayLap(r[c.ngay]),
      mstBan: mst(r[c.mstBan]),
      tenBan: o(r, c.tenBan),
      dchiBan: o(r, c.dcBan),
      mstMua: c.mstMua >= 0 ? mst(r[at(c.mstMua)]) : d ? mst(r[c.chuaThue]) : '',
      tenMua: o(r, at(c.tenMua)),
      dchiMua: o(r, at(c.dcMua)),
      chuaThue,
      thue,
      trangThai,
      file: tenFile,
    })
  }
  // Dòng "Từ ngày 01/10/2025 đến ngày 31/10/2025" phía trên tiêu đề
  let tu: string | undefined
  let den: string | undefined
  for (const r of rows.slice(0, iTieuDe)) {
    const m = /Từ ngày\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*đến ngày\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec((r ?? []).map(chuan).join(' '))
    if (m) {
      tu = m[1]
      den = m[2]
      break
    }
  }
  return { ten: tenFile, hoaDon, goiY, tu, den, ...(suaLechCot ? { suaLechCot } : {}), ...(boDong ? { boDong } : {}) }
}

export interface KetQuaPhanLoai {
  /** MST "công ty mình" — tìm ra từ chính các file nếu chưa biết */
  mst: string | null
  tenCongTy: string
  dchiCongTy: string
  hoaDon: HoaDon[]
  /** Mỗi file: số hoá đơn bán ra / mua vào / không liên quan */
  theoTep: Record<string, { ban: number; mua: number; khac: number; epBuoc: boolean }>
  canhBao: CanhBao[]
}

/**
 * Tự nhận diện hoá đơn bán ra / mua vào.
 * 1) Tìm MST công ty: MST xuất hiện ở MỌI dòng của một file (cột người bán hoặc cột người mua),
 *    chọn MST có mặt ở nhiều file nhất. Đã biết MST (từ tờ khai) thì dùng luôn.
 * 2) Xếp TỪNG hoá đơn: công ty là người bán -> bán ra; là người mua -> mua vào.
 *    Nhờ vậy file gộp lẫn cả bán và mua cũng tách đúng.
 * 3) `epBuoc[tenFile]` = người dùng tự chọn loại cho cả file (khi app nhận sai).
 */
export function phanLoai(teps: TepHoaDon[], mstBiet?: string | null, epBuoc: Record<string, LoaiHD> = {}): KetQuaPhanLoai {
  const canhBao: CanhBao[] = []
  // Ứng viên "công ty mình": MST có mặt ở MỌI hoá đơn của một file (đứng bên bán hoặc bên mua).
  // File bỏ trống hẳn một cột MST (bản tải kiểu cũ bỏ trống MST của chính mình) thì không lấy ứng viên
  // từ file đó — MST còn lại trong file là của ĐỐI TÁC.
  const ungVien = new Map<string, { laBan: number; laMua: number; soDong: number }>()
  for (const t of teps) {
    const n = t.hoaDon.length
    if (!n || t.hoaDon.every((h) => !h.mstBan) || t.hoaDon.every((h) => !h.mstMua)) continue
    const dem = new Map<string, { dong: number; ban: boolean; mua: boolean }>()
    for (const h of t.hoaDon) {
      for (const [m, ben] of [[h.mstBan, 'ban'], [h.mstMua, 'mua']] as const) {
        if (!m) continue
        const d = dem.get(m) ?? { dong: 0, ban: false, mua: false }
        d[ben] = true
        dem.set(m, d)
      }
      for (const m of new Set([h.mstBan, h.mstMua])) if (m) dem.get(m)!.dong++
    }
    for (const [m, d] of dem) {
      if (d.dong !== n) continue
      const u = ungVien.get(m) ?? { laBan: 0, laMua: 0, soDong: 0 }
      if (d.ban) u.laBan++
      if (d.mua) u.laMua++
      u.soDong += n
      ungVien.set(m, u)
    }
  }

  let mstCty: string | null = mstBiet || null
  if (!mstCty) {
    // Điểm: vừa là người bán (file này) vừa là người mua (file khác) là chắc nhất
    const diem = (u: { laBan: number; laMua: number; soDong: number }) => (u.laBan && u.laMua ? 1000 : 0) + (u.laBan + u.laMua) * 10
    const xep = [...ungVien.entries()].sort((a, b) => diem(b[1]) - diem(a[1]) || b[1].soDong - a[1].soDong)
    const nhat = xep[0]
    if (nhat) {
      const hoa = xep[1] && diem(xep[1][1]) === diem(nhat[1])
      if (hoa) {
        // Không phân định được bằng MST: nhờ gợi ý tiêu đề cột
        const t = teps.find((x) => x.goiY && x.hoaDon.length)
        if (t) mstCty = t.goiY === 'ban' ? t.hoaDon[0].mstBan : t.hoaDon[0].mstMua
      } else mstCty = nhat[0]
      if (mstCty && !(nhat[1].laBan && nhat[1].laMua)) {
        canhBao.push({ muc: 'chu_y', noiDung: `App ĐOÁN công ty là MST ${mstCty} (chỉ có hoá đơn một chiều nên chưa chắc chắn). Kéo một file tờ khai XML đã nộp vào để xác định chắc chắn.` })
      }
    }
  } else if (teps.some((t) => t.hoaDon.length) && ungVien.size && !ungVien.has(mstBiet!)) {
    const khac = [...ungVien.keys()][0]
    canhBao.push({ muc: 'loi', noiDung: `Các file hoá đơn không có MST ${mstBiet} của công ty đang chọn — có vẻ là hoá đơn của MST ${khac}. Kiểm tra lại đã tải đúng công ty chưa.` })
  }

  const hoaDon: HoaDon[] = []
  const theoTep: KetQuaPhanLoai['theoTep'] = {}
  let tenCongTy = ''
  let dchiCongTy = ''
  for (const t of teps) {
    const dem = { ban: 0, mua: 0, khac: 0, epBuoc: !!epBuoc[t.ten] }
    for (const h0 of t.hoaDon) {
      const loai: LoaiHD | null =
        epBuoc[t.ten] ??
        (mstCty && h0.mstBan === mstCty ? 'ban'
          : mstCty && h0.mstMua === mstCty ? 'mua'
          // Bản tải về kiểu cũ bỏ trống MST của chính mình: bên nào trống MST là công ty mình
          : !h0.mstBan && h0.mstMua ? 'ban'
          : !h0.mstMua && h0.mstBan ? 'mua'
          : null)
      if (!loai) {
        dem.khac++
        continue
      }
      dem[loai]++
      const h = { ...h0, loai }
      hoaDon.push(h)
      if (!tenCongTy) tenCongTy = loai === 'ban' ? h.tenBan : h.tenMua
      if (!dchiCongTy) dchiCongTy = (loai === 'ban' ? h.dchiBan : h.dchiMua) ?? ''
    }
    theoTep[t.ten] = dem
    if (t.suaLechCot) canhBao.push({ muc: 'chu_y', noiDung: `${t.ten}: ${t.suaLechCot} dòng bị lệch cột (file ghép từ nhiều lần tải) — app đã tự đọc lại đúng cột. Nên mở file kiểm tra.` })
    if (t.boDong) canhBao.push({ muc: 'loi', noiDung: `${t.ten}: bỏ ${t.boDong} dòng có số tiền vô lý (nghi lệch cột không tự sửa được). Mở file kiểm tra các dòng đó.` })
    if (dem.khac) canhBao.push({ muc: 'chu_y', noiDung: `${t.ten}: ${dem.khac} hoá đơn không có MST ${mstCty ?? 'công ty'} ở bên bán lẫn bên mua — đã bỏ ra. Có tải nhầm file đơn vị khác không?` })
  }
  return { mst: mstCty, tenCongTy, dchiCongTy, hoaDon, theoTep, canhBao }
}

/** Đọc + phân loại 1 sheet (giữ cho test cũ / dùng lẻ) */
export function docDanhSachHoaDon(rows: O[][], tenFile: string, mstCongTy?: string) {
  const t = docTep(rows, tenFile)
  if (!t) return { hoaDon: [] as HoaDon[], loai: null as LoaiHD | null, canhBao: [{ muc: 'chu_y', noiDung: `${tenFile}: không phải file "Danh sách hóa đơn" — bỏ qua` }] as CanhBao[] }
  const kq = phanLoai([t], mstCongTy)
  const d = kq.theoTep[tenFile]
  const loai: LoaiHD | null = d.ban && !d.mua ? 'ban' : d.mua && !d.ban ? 'mua' : null
  return { hoaDon: kq.hoaDon, loai, canhBao: kq.canhBao }
}

/** Hoá đơn còn hiệu lực để kê khai: bỏ hoá đơn đã bị thay thế, đã huỷ */
export function conHieuLuc(h: HoaDon): boolean {
  const t = h.trangThai.toLowerCase()
  return !(t.includes('bị thay thế') || t.includes('xóa bỏ') || t.includes('hủy bỏ') || t.includes('xoá bỏ') || t.includes('huỷ bỏ'))
}

// Hoá đơn bán ra: không ghép MST người bán vào khoá (có file bỏ trống MST của chính mình) — xem kho.ts
const khoa = (h: HoaDon) => `${h.loai}|${h.loai === 'ban' ? '' : h.mstBan}|${h.kyHieu}|${Number(h.so) || h.so}`

export interface GopHoaDon {
  ban: HoaDon[]
  mua: HoaDon[]
  ngoaiKy: HoaDon[]
  boQua: HoaDon[] // bị thay thế / huỷ
  trung: number
}

/** Gộp nhiều file, bỏ trùng, tách hoá đơn ngoài kỳ và hoá đơn hết hiệu lực */
export function gopHoaDon(ds: HoaDon[], ky: KyKeKhai): GopHoaDon {
  // Cùng một hoá đơn có thể nằm ở 2 file tải về 2 lần khác nhau. Nếu một bản đã ghi
  // "bị thay thế/huỷ" thì đó là trạng thái mới nhất — ưu tiên bản đó.
  const theoKhoa = new Map<string, HoaDon>()
  const kq: GopHoaDon = { ban: [], mua: [], ngoaiKy: [], boQua: [], trung: 0 }
  for (const h of ds) {
    const k = khoa(h)
    const co = theoKhoa.get(k)
    if (co) {
      kq.trung++
      if (conHieuLuc(co) && !conHieuLuc(h)) theoKhoa.set(k, h)
    } else theoKhoa.set(k, h)
  }
  for (const h of theoKhoa.values()) {
    if (!conHieuLuc(h)) kq.boQua.push(h)
    else if (!trongKy(h.ngay, ky)) kq.ngoaiKy.push(h)
    else kq[h.loai].push(h)
  }
  return kq
}

/** Soát số hoá đơn bán ra theo từng ký hiệu: hụt số giữa chừng thường là do tải thiếu file */
export function kiemSoHoaDonBan(ban: HoaDon[]): CanhBao[] {
  const theoKyHieu = new Map<string, number[]>()
  for (const h of ban) {
    const n = Number(h.so)
    if (!Number.isInteger(n)) continue
    theoKyHieu.set(h.kyHieu, [...(theoKyHieu.get(h.kyHieu) ?? []), n])
  }
  const kq: CanhBao[] = []
  for (const [kh, ds] of theoKyHieu) {
    const co = new Set(ds)
    const thieu: number[] = []
    for (let i = Math.min(...ds); i <= Math.max(...ds); i++) if (!co.has(i)) thieu.push(i)
    if (thieu.length) {
      kq.push({ muc: 'chu_y', noiDung: `Hoá đơn bán ra ký hiệu ${kh} hụt số ${thieu.slice(0, 15).join(', ')}${thieu.length > 15 ? '…' : ''}. Kiểm tra đã tải đủ file các tháng chưa (hoặc các số đó thuộc quý khác / đã huỷ).` })
    }
  }
  return kq
}

/** Các tháng (yyyy-MM) từ ngày tu đến ngày den */
export function cacThang(tu: string, den: string): string[] {
  const a = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(tu)
  const b = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(den)
  if (!a || !b) return []
  const kq: string[] = []
  for (let y = Number(a[3]), m = Number(a[2]); y * 12 + m <= Number(b[3]) * 12 + Number(b[2]) && kq.length < 60; m === 12 ? (y++, (m = 1)) : m++) {
    kq.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return kq
}

export interface PhuSong {
  ban: string[]
  mua: string[]
}

/**
 * Một file "Danh sách hóa đơn" phủ những tháng nào, cho chiều nào (bán ra / mua vào).
 * = các tháng trong kỳ ghi trên đầu file  +  các tháng thực có hoá đơn trong file
 *   (file người dùng tự gộp nhiều tháng thường giữ nguyên tiêu đề của tháng đầu).
 * `hoaDon`: hoá đơn của file đã được phanLoai() xếp bán/mua.
 */
export function phuSongCuaTep(t: TepHoaDon, hoaDon: HoaDon[]): PhuSong {
  const kq: PhuSong = { ban: [], mua: [] }
  const theoKy = t.tu && t.den ? cacThang(t.tu, t.den) : []
  for (const l of ['ban', 'mua'] as const) {
    const ds = hoaDon.filter((h) => h.loai === l)
    if (!ds.length) continue
    const thang = new Set(theoKy)
    for (const h of ds) {
      const m = /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(h.ngay)
      if (m) thang.add(`${m[2]}-${m[1].padStart(2, '0')}`)
    }
    kq[l] = [...thang].sort()
  }
  return kq
}

/** Quý có nhiều hoá đơn nhất trong một nhóm hoá đơn (để ghi "kỳ" của file khi lưu lên mây) */
export function quyNhieuNhat(ds: { ngay: string }[]): KyKeKhai | null {
  const dem = new Map<string, number>()
  for (const h of ds) {
    const m = /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(h.ngay)
    if (m) {
      const k = `${m[2]}-${Math.ceil(Number(m[1]) / 3)}`
      dem.set(k, (dem.get(k) ?? 0) + 1)
    }
  }
  const top = [...dem.entries()].sort((a, b) => b[1] - a[1])[0]
  if (!top) return null
  const [nam, quy] = top[0].split('-').map(Number)
  return { nam, quy: quy as 1 | 2 | 3 | 4 }
}

/** Các tháng mà các sheet của MỘT file phủ, sau khi đã xếp bán/mua theo công ty */
export function phuSongFile(ts: TepHoaDon[], mstCty: string): PhuSong {
  const kq: PhuSong = { ban: [], mua: [] }
  for (const t of ts) {
    const p = phuSongCuaTep(t, phanLoai([t], mstCty).hoaDon)
    kq.ban.push(...p.ban)
    kq.mua.push(...p.mua)
  }
  return { ban: [...new Set(kq.ban)].sort(), mua: [...new Set(kq.mua)].sort() }
}
