// "Sổ theo dõi tờ khai": lấy các file XML đã nộp làm gốc.
//  - Thông tin công ty: tự điền từ tờ khai mới nhất, sửa tay được (sửa tay thì XML nạp sau không ghi đè).
//  - Nhiều công ty: ai nhờ khai hộ thì thêm công ty đó.
//  - Lịch sử 01/GTGT từng quý, tách bản LẦN ĐẦU (C) và bản BỔ SUNG (B).
//
// Quy tắc cơ quan thuế (thông báo không chấp nhận Q2/2026 của chính công ty):
//   "Chỉ tiêu [22] NNT kê khai phải = Chỉ tiêu [43] trên TK lần đầu của kỳ liền kề trước"
// => [22] lấy từ bản LẦN ĐẦU. Khai bổ sung kỳ trước làm đổi [43] thì phần chênh không đưa vào [22].

import type { HoaDon, HoSoDN, KyKeKhai } from './types'
import type { ToKhaiDaNop } from './docToKhai'
import type { ChungTu, TaiLieu } from './taiLieu'
import { conHieuLuc } from './excel'

export interface PhienBanGTGT {
  loaiTKhai: 'C' | 'B'
  soLan: number
  ngayLap: string
  ct22: number
  ct36: number
  ct40: number
  ct41: number
  ct43: number
  /** Thêm cho tổng quan: doanh thu [34], thuế đầu ra [35], mua vào [23], thuế đầu vào [24] */
  ct34?: number
  ct35?: number
  ct23?: number
  ct24?: number
  /** Phụ lục giảm thuế: mục I (người bán, hàng mua vào 8%) và mục II (người mua). undefined = chưa đọc */
  plMua?: { ten: string; giaTri: number; thue: number }[]
  plBan?: { ten: string; giaTri: number; thueGiam: number }[]
  nguon: 'xml' | 'app'
  tenFile: string
  /** Người dùng đánh dấu: cơ quan thuế KHÔNG chấp nhận bản này -> không dùng */
  khongChapNhan?: boolean
  /** Mã các bản ghi trên mây (Firestore) ứng với phiên bản này — có thể nhiều bản trùng số liệu */
  ids?: string[]
}

export interface CongTyLuu {
  hoSo: HoSoDN
  /** Kỳ của tờ khai đã dùng để điền thông tin (yyyy-Qn) */
  kyNguon: string
  suaTay: boolean
}

/** Tờ khai loại khác (môn bài, quyết toán, BCTC...) — lưu để liệt kê, chưa tính toán */
export interface ToKhaiKhac {
  maTKhai: string
  tenTKhai: string
  ky: string // 2025, 2025-Q3, 2025-M07
  loaiTKhai: string
  soLan: number
  ngayLap: string
  tenFile: string
}

/** Hoá đơn rút gọn để làm tổng quan (đối chiếu doanh thu tờ khai với hoá đơn) */
export interface HoaDonGon {
  l: 'ban' | 'mua'
  mb: string // MST người bán (để nhận dạng hoá đơn mua vào)
  mm?: string // MST người mua (để gom khách hàng; dữ liệu cũ có thể thiếu)
  /** 1 = chỉ biết từ file hoá đơn XML lẻ (không phải danh sách trọn kỳ) */
  x?: 1
  kh: string
  so: string
  ng: string // dd/MM/yyyy
  ten: string // tên đối tác
  v: number // chưa thuế
  t: number // thuế
  tt: string // trạng thái
}

export interface Kho {
  phienBan: 1
  chon: string | null
  congTy: Record<string, CongTyLuu>
  gtgt: Record<string, Record<string, PhienBanGTGT[]>>
  tncn: Record<string, Record<string, Record<string, number>>>
  /** Thêm từ bản có tổng quan — sổ cũ không có thì coi như rỗng */
  toKhaiKhac?: Record<string, Record<string, ToKhaiKhac>>
  chungTu?: Record<string, Record<string, ChungTu>>
  hoaDon?: Record<string, Record<string, HoaDonGon>>
  /** Các tháng (yyyy-MM) đã có DANH SÁCH hoá đơn tải từ cổng thuế, theo chiều — để biết quý nào đủ */
  phuSong?: Record<string, { ban: string[]; mua: string[] }>
}

export const khoTrong = (): Kho => ({ phienBan: 1, chon: null, congTy: {}, gtgt: {}, tncn: {} })

export const khoaKy = (ky: KyKeKhai) => `${ky.nam}-Q${ky.quy}`
export const tenKy = (khoa: string) => khoa.replace(/^(\d{4})-Q(\d)$/, '$2/$1')
export function kyTruoc(ky: KyKeKhai): KyKeKhai {
  return ky.quy === 1 ? { quy: 4, nam: ky.nam - 1 } : { quy: (ky.quy - 1) as 1 | 2 | 3, nam: ky.nam }
}
const khoaTruoc = (khoa: string) => {
  const m = /^(\d{4})-Q(\d)$/.exec(khoa)!
  return khoaKy(kyTruoc({ quy: Number(m[2]) as 1 | 2 | 3 | 4, nam: Number(m[1]) }))
}

/** Gộp thông tin công ty: ô nào bản mới có thì lấy bản mới; đã sửa tay thì chỉ điền ô còn trống */
function gopHoSo(cu: CongTyLuu | undefined, moi: HoSoDN, kyMoi: string): CongTyLuu {
  if (!cu) return { hoSo: { ...moi }, kyNguon: kyMoi, suaTay: false }
  const ghiDe = !cu.suaTay && kyMoi >= cu.kyNguon
  const hoSo = { ...cu.hoSo }
  for (const k of Object.keys(moi) as (keyof HoSoDN)[]) {
    if (!moi[k]) continue
    if (ghiDe || !hoSo[k]) hoSo[k] = moi[k]
  }
  return { hoSo, kyNguon: ghiDe ? kyMoi : cu.kyNguon, suaTay: cu.suaTay }
}

export interface KetQuaNap {
  kho: Kho
  moTa: string
  loi?: boolean
}

/** Nạp một tờ khai XML đã đọc vào sổ */
export function napToKhai(kho0: Kho, tk: ToKhaiDaNop, tenFile: string, id?: string): KetQuaNap {
  const mst = tk.hoSo.mst
  if (!mst || !tk.ky) return { kho: kho0, moTa: 'Không đọc được MST hoặc kỳ kê khai', loi: true }
  if (tk.maTKhai !== '842' && tk.maTKhai !== '864') {
    return { kho: kho0, moTa: `Tờ khai mã ${tk.maTKhai} — app chưa dùng loại này`, loi: true }
  }
  const kho: Kho = structuredClone(kho0)
  const khoa = khoaKy(tk.ky)
  kho.congTy[mst] = gopHoSo(kho.congTy[mst], tk.hoSo, khoa)
  if (!kho.chon) kho.chon = mst

  if (tk.maTKhai === '864') {
    ;(kho.tncn[mst] ??= {})[khoa] = { ...tk.ct }
    return { kho, moTa: `05/KK-TNCN quý ${tenKy(khoa)} — dùng để điền sẵn tờ TNCN` }
  }

  const pb: PhienBanGTGT = {
    loaiTKhai: tk.loaiTKhai === 'B' ? 'B' : 'C',
    soLan: tk.soLan,
    ngayLap: tk.ngayLap,
    ct22: tk.ct.ct22 ?? 0,
    ct36: tk.ct.ct36 ?? 0,
    ct40: tk.ct.ct40 ?? 0,
    ct41: tk.ct.ct41 ?? 0,
    ct43: tk.ct.ct43 ?? 0,
    ct34: tk.ct.ct34 ?? 0,
    ct35: tk.ct.ct35 ?? 0,
    ct23: tk.ct.ct23 ?? 0,
    ct24: tk.ct.ct24 ?? 0,
    plMua: tk.plMua.filter((d) => d.ten),
    plBan: tk.plBan.filter((d) => d.ten),
    nguon: 'xml',
    tenFile,
    ids: id ? [id] : [],
  }
  const ds = ((kho.gtgt[mst] ??= {})[khoa] ??= [])
  // Bỏ bản do app tự ghi khi xuất (giờ đã có bản thật); bỏ bản trùng (cùng loại, lần, số liệu: vd bản chưa ký và bản đã ký)
  const giu = ds.filter((x) => x.nguon !== 'app' && !(x.loaiTKhai === pb.loaiTKhai && x.soLan === pb.soLan && x.ct22 === pb.ct22 && x.ct43 === pb.ct43 && x.ct40 === pb.ct40))
  const cu = ds.find((x) => x.nguon !== 'app' && x.loaiTKhai === pb.loaiTKhai && x.soLan === pb.soLan && x.ct43 === pb.ct43 && x.ct40 === pb.ct40)
  if (cu?.khongChapNhan) pb.khongChapNhan = true
  if (cu?.ids) pb.ids = [...new Set([...cu.ids, ...(pb.ids ?? [])])]
  kho.gtgt[mst][khoa] = [...giu, pb]
  const loai = pb.loaiTKhai === 'B' ? `bổ sung lần ${pb.soLan}` : 'lần đầu'
  return { kho, moTa: `01/GTGT quý ${tenKy(khoa)} (${loai}): [22] = ${pb.ct22.toLocaleString('vi-VN')}, [40] = ${pb.ct40.toLocaleString('vi-VN')}, [43] = ${pb.ct43.toLocaleString('vi-VN')}` }
}

/** Ghi tờ khai app vừa xuất (chỉ để nhớ khi chưa có file XML thật của quý đó) */
export function ghiAppXuat(kho0: Kho, mst: string, ky: KyKeKhai, ct: Record<string, number>): Kho {
  const kho: Kho = structuredClone(kho0)
  const ds = ((kho.gtgt[mst] ??= {})[khoaKy(ky)] ??= [])
  if (ds.some((x) => x.nguon === 'xml' && x.loaiTKhai === 'C' && !x.khongChapNhan)) return kho
  kho.gtgt[mst][khoaKy(ky)] = [
    ...ds.filter((x) => x.nguon !== 'app'),
    { loaiTKhai: 'C', soLan: 0, ngayLap: '', ct22: ct.ct22, ct36: ct.ct36, ct40: ct.ct40, ct41: ct.ct41, ct43: ct.ct43, ct34: ct.ct34, ct35: ct.ct35, ct23: ct.ct23, ct24: ct.ct24, nguon: 'app', tenFile: '(app xuất, chưa nạp file đã nộp)' },
  ]
  return kho
}

export function datKhongChapNhan(kho0: Kho, mst: string, khoa: string, i: number, gt: boolean): Kho {
  const kho: Kho = structuredClone(kho0)
  const pb = kho.gtgt[mst]?.[khoa]?.[i]
  if (pb) pb.khongChapNhan = gt
  return kho
}

export function suaHoSo(kho0: Kho, hoSo: HoSoDN): Kho {
  const kho: Kho = structuredClone(kho0)
  const cu = kho.congTy[hoSo.mst]
  kho.congTy[hoSo.mst] = { hoSo: { ...hoSo }, kyNguon: cu?.kyNguon ?? '', suaTay: true }
  kho.chon = hoSo.mst
  return kho
}

export interface TinhTrangKy {
  lanDau: PhienBanGTGT | null
  /** Có nhiều bản lần đầu (được chấp nhận) khác số liệu nhau — phải đánh dấu bản bị trả về */
  xungDot: boolean
  boSungMoiNhat: PhienBanGTGT | null
}

export function tinhTrangKy(kho: Kho, mst: string, khoa: string): TinhTrangKy {
  const ds = (kho.gtgt[mst]?.[khoa] ?? []).filter((x) => !x.khongChapNhan)
  const c = ds.filter((x) => x.loaiTKhai === 'C')
  const b = ds.filter((x) => x.loaiTKhai === 'B').sort((x, y) => y.soLan - x.soLan)
  const xungDot = new Set(c.map((x) => x.ct43)).size > 1
  return { lanDau: c.length && !xungDot ? c[0] : null, xungDot, boSungMoiNhat: b[0] ?? null }
}

export interface DauKy {
  /** [43] tờ khai LẦN ĐẦU quý trước — chính là [22] phải khai. null = chưa biết */
  ct22: number | null
  ghiChu: string
  xungDot: boolean
  /** Bổ sung quý trước làm [43] thay đổi bao nhiêu (bản bổ sung − bản lần đầu) */
  chenhBoSung: number
}

export function dauKy(kho: Kho, mst: string, ky: KyKeKhai): DauKy {
  const khoa = khoaKy(kyTruoc(ky))
  const t = tinhTrangKy(kho, mst, khoa)
  if (t.xungDot) return { ct22: null, ghiChu: `Quý ${tenKy(khoa)} có nhiều bản lần đầu khác số liệu — đánh dấu bản bị cơ quan thuế trả về ở bước 1`, xungDot: true, chenhBoSung: 0 }
  if (!t.lanDau) return { ct22: null, ghiChu: '', xungDot: false, chenhBoSung: 0 }
  const chen = t.boSungMoiNhat ? t.boSungMoiNhat.ct43 - t.lanDau.ct43 : 0
  return {
    ct22: t.lanDau.ct43,
    ghiChu: `= [43] tờ khai lần đầu quý ${tenKy(khoa)}${t.lanDau.nguon === 'app' ? ' (bản app đã xuất — nạp file đã nộp để chắc chắn)' : ''}`,
    xungDot: false,
    chenhBoSung: chen,
  }
}

export interface DongSoCai {
  khoa: string
  ds: PhienBanGTGT[]
  /** [22] bản lần đầu quý này có bằng [43] bản lần đầu quý trước không (null = thiếu quý trước) */
  khop: boolean | null
}

/** Sổ cái: các quý đã nạp, kiểm chuỗi đầu kỳ – cuối kỳ */
export function soCai(kho: Kho, mst: string): DongSoCai[] {
  const theoKy = kho.gtgt[mst] ?? {}
  return Object.keys(theoKy)
    .sort()
    .map((khoa) => {
      const nay = tinhTrangKy(kho, mst, khoa).lanDau
      const truoc = tinhTrangKy(kho, mst, khoaTruoc(khoa)).lanDau
      return { khoa, ds: theoKy[khoa], khop: nay && truoc ? nay.ct22 === truoc.ct43 : null }
    })
}

/** Số liệu TNCN của quý gần nhất trước quý đang khai (để điền sẵn) */
export function tncnGanNhat(kho: Kho, mst: string, ky: KyKeKhai): Record<string, number> | null {
  const theoKy = kho.tncn[mst] ?? {}
  const k = Object.keys(theoKy).filter((x) => x < khoaKy(ky)).sort().pop()
  return k ? theoKy[k] : null
}

/** Một tờ khai đã lưu trên mây (Firestore), đủ để dựng lại sổ mà không cần tải file XML về */
export interface ToKhaiMay {
  id: string
  mst: string
  maTKhai: string
  tenTKhai?: string
  plMua?: { ten: string; giaTri: number; thue: number }[]
  plBan?: { ten: string; giaTri: number; thueGiam: number }[]
  ky: string // yyyy-Qn
  loaiTKhai: string
  soLan: number
  ngayLap: string
  ct: Record<string, number>
  tenFile: string
  khongChapNhan?: boolean
}

/** Gộp dữ liệu trên mây vào sổ trên máy (hợp nhất, không xoá gì của máy) */
export function gopTuMay(
  kho0: Kho,
  congTy: CongTyLuu[],
  toKhai: ToKhaiMay[],
  chungTu: ChungTu[] = [],
  hoaDon: { mst: string; hd: HoaDonGon[]; phu?: { ban: string[]; mua: string[] } }[] = [],
): Kho {
  let kho = kho0
  for (const t of toKhai) {
    const hoSo = congTy.find((c) => c.hoSo.mst === t.mst)?.hoSo ?? kho.congTy[t.mst]?.hoSo
    if (!hoSo) continue
    if (t.maTKhai !== '842' && t.maTKhai !== '864') {
      kho = structuredClone(kho)
      ;((kho.toKhaiKhac ??= {})[t.mst] ??= {})[khoaKhac(t.maTKhai, t.ky, t.loaiTKhai, t.soLan)] = { maTKhai: t.maTKhai, tenTKhai: t.tenTKhai ?? '', ky: t.ky, loaiTKhai: t.loaiTKhai, soLan: t.soLan, ngayLap: t.ngayLap, tenFile: t.tenFile }
      continue
    }
    const m = /^(\d{4})-Q(\d)$/.exec(t.ky)
    if (!m) continue
    kho = napToKhai(kho, {
      maTKhai: t.maTKhai, loaiTKhai: t.loaiTKhai, soLan: t.soLan, ngayLap: t.ngayLap,
      ky: { quy: Number(m[2]) as 1 | 2 | 3 | 4, nam: Number(m[1]) }, hoSo, ct: t.ct, plMua: t.plMua ?? [], plBan: t.plBan ?? [], ct9: null,
    }, t.tenFile, t.id).kho
    if (!t.plMua && !t.plBan) {
      // bản ghi cũ trên mây chưa có phụ lục: đánh dấu "chưa đọc" (khác với phụ lục rỗng)
      const pb = kho.gtgt[t.mst]?.[t.ky]?.find((x) => x.ids?.includes(t.id))
      if (pb && !pb.plMua?.length && !pb.plBan?.length) {
        delete pb.plMua
        delete pb.plBan
      }
    }
    if (t.khongChapNhan) {
      const ds = kho.gtgt[t.mst]?.[t.ky] ?? []
      const i = ds.findIndex((x) => x.ids?.includes(t.id))
      if (i >= 0) kho = datKhongChapNhan(kho, t.mst, t.ky, i, true)
    }
  }
  kho = structuredClone(kho)
  for (const c of chungTu) ((kho.chungTu ??= {})[c.mst] ??= {})[c.so] = c
  for (const { mst, hd, phu } of hoaDon) {
    if (phu) kho = ghiPhuSong(kho, mst, phu)
    kho = napHoaDon(kho, mst, hd.filter((g) => !g.x).map((g) => moRongHoaDon(g, mst)))
    kho = napHoaDon(kho, mst, hd.filter((g) => g.x).map((g) => moRongHoaDon(g, mst)), true)
  }
  kho = structuredClone(kho)
  // Thông tin công ty trên mây là bản người dùng đã chốt -> ưu tiên
  for (const c of congTy) kho.congTy[c.hoSo.mst] = structuredClone(c)
  if (!kho.chon && congTy[0]) kho.chon = congTy[0].hoSo.mst
  return kho
}

// Hoá đơn BÁN RA đều là của chính công ty -> nhận dạng bằng ký hiệu + số (file Excel kiểu cũ bỏ trống MST
// của mình, file XML thì có: nếu ghép cả MST vào khoá thì cùng một hoá đơn bị tính 2 lần)
const khoaGon = (h: Pick<HoaDon, 'loai' | 'mstBan' | 'kyHieu' | 'so'>) =>
  `${h.loai}|${h.loai === 'ban' ? '' : h.mstBan}|${h.kyHieu}|${Number(h.so) || h.so}`

/** Nạp hoá đơn (đã biết bán/mua) vào sổ rút gọn. Trùng thì giữ trạng thái "bị thay thế/huỷ" nếu có. */
export function napHoaDon(kho0: Kho, mst: string, ds: HoaDon[], tuXmlLe = false): Kho {
  const kho: Kho = structuredClone(kho0)
  const nhom = ((kho.hoaDon ??= {})[mst] ??= {})
  for (const h of ds) {
    const k = khoaGon(h)
    const cu = nhom[k]
    if (cu && conHieuLuc({ trangThai: cu.tt } as HoaDon) === false && conHieuLuc(h)) continue
    // Đã có từ danh sách trọn kỳ (Excel) thì giữ, không để bản XML lẻ ghi đè dấu "trọn kỳ"
    if (cu && !cu.x && tuXmlLe) continue
    nhom[k] = { ...(tuXmlLe ? { x: 1 as const } : {}), l: h.loai, mb: h.mstBan, mm: h.mstMua, kh: h.kyHieu, so: h.so, ng: h.ngay, ten: h.loai === 'ban' ? h.tenMua : h.tenBan, v: h.chuaThue, t: h.thue, tt: h.trangThai }
  }
  return kho
}

const khoaKhac = (ma: string, ky: string, loai: string, lan: number) => `${ma}|${ky}|${loai}|${lan}`

/** Nạp bất kỳ tài liệu XML nào đã đọc bằng docTaiLieu() */
export function napTaiLieu(kho0: Kho, tl: TaiLieu, tenFile: string, id?: string): KetQuaNap {
  if (tl.loai === 'toKhai') {
    if (tl.tk.maTKhai === '842' || tl.tk.maTKhai === '864') return napToKhai(kho0, tl.tk, tenFile, id)
    const mst = tl.tk.hoSo.mst
    if (!mst) return { kho: kho0, moTa: 'Tờ khai không có MST', loi: true }
    const kho: Kho = structuredClone(kho0)
    kho.congTy[mst] = gopHoSo(kho.congTy[mst], tl.tk.hoSo, tl.kyChu.slice(0, 7))
    if (!kho.chon) kho.chon = mst
    // Cùng mẫu + kỳ + loại + lần = cùng một tờ khai (dù nạp từ file hay từ mây)
    const khoa = khoaKhac(tl.tk.maTKhai, tl.kyChu, tl.tk.loaiTKhai, tl.tk.soLan)
    ;((kho.toKhaiKhac ??= {})[mst] ??= {})[khoa] = {
      maTKhai: tl.tk.maTKhai, tenTKhai: tl.tenTKhai, ky: tl.kyChu, loaiTKhai: tl.tk.loaiTKhai, soLan: tl.tk.soLan, ngayLap: tl.tk.ngayLap, tenFile,
    }
    return { kho, moTa: `${tl.tenTKhai || 'Tờ khai mã ' + tl.tk.maTKhai} — kỳ ${tl.kyChu} (lưu trữ)` }
  }
  if (tl.loai === 'chungTu') {
    const mst = tl.ct.mst
    if (!mst) return { kho: kho0, moTa: 'Chứng từ không có MST', loi: true }
    const kho: Kho = structuredClone(kho0)
    ;((kho.chungTu ??= {})[mst] ??= {})[tl.ct.so] = tl.ct
    return { kho, moTa: `Chứng từ nộp tiền số ${tl.ct.so} ngày ${tl.ct.ngay}: ${tl.ct.tong.toLocaleString('vi-VN')} đ` }
  }
  if (tl.loai === 'hoaDon') {
    const h = tl.hd
    const mst = kho0.congTy[h.mstBan] ? h.mstBan : kho0.congTy[h.mstMua] ? h.mstMua : null
    if (!mst) return { kho: kho0, moTa: `Hoá đơn ${h.kyHieu}-${h.so}: chưa biết của công ty nào — nạp tờ khai XML của công ty trước`, loi: true }
    const loai = mst === h.mstBan ? 'ban' : 'mua'
    return { kho: napHoaDon(kho0, mst, [{ ...h, loai, file: tenFile }], true), moTa: `Hoá đơn ${loai === 'ban' ? 'bán ra' : 'mua vào'} ${h.kyHieu}-${h.so} ngày ${h.ngay}` }
  }
  return { kho: kho0, moTa: `File XML loại "${tl.goc}" — chưa đọc được loại này`, loi: true }
}

/** Hoá đơn rút gọn -> dạng đầy đủ tối thiểu (để nạp lại từ mây) */
export function moRongHoaDon(g: HoaDonGon, mst: string): HoaDon {
  return {
    loai: g.l, kyHieuMau: '', kyHieu: g.kh, so: g.so, ngay: g.ng,
    mstBan: g.l === 'ban' ? mst : g.mb, tenBan: g.l === 'ban' ? '' : g.ten,
    mstMua: g.l === 'mua' ? mst : g.mm ?? '', tenMua: g.l === 'ban' ? g.ten : '',
    chuaThue: g.v, thue: g.t, trangThai: g.tt, file: '',
  }
}

/** Rút gọn danh sách hoá đơn để lưu lên mây cùng file Excel */
export function rutGonHoaDon(ds: HoaDon[], tuXmlLe = false): HoaDonGon[] {
  return ds.map((h) => ({ ...(tuXmlLe ? { x: 1 as const } : {}), l: h.loai, mb: h.mstBan, mm: h.mstMua, kh: h.kyHieu, so: h.so, ng: h.ngay, ten: h.loai === 'ban' ? h.tenMua : h.tenBan, v: h.chuaThue, t: h.thue, tt: h.trangThai }))
}

/** Ghi nhận các tháng đã có danh sách hoá đơn (hợp nhất, không trùng) */
export function ghiPhuSong(kho0: Kho, mst: string, phu: { ban: string[]; mua: string[] }): Kho {
  if (!phu.ban.length && !phu.mua.length) return kho0
  const kho: Kho = structuredClone(kho0)
  const cu = ((kho.phuSong ??= {})[mst] ??= { ban: [], mua: [] })
  cu.ban = [...new Set([...cu.ban, ...phu.ban])].sort()
  cu.mua = [...new Set([...cu.mua, ...phu.mua])].sort()
  return kho
}
