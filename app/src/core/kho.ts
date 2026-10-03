// "Sổ theo dõi tờ khai": lấy các file XML đã nộp làm gốc.
//  - Thông tin công ty: tự điền từ tờ khai mới nhất, sửa tay được (sửa tay thì XML nạp sau không ghi đè).
//  - Nhiều công ty: ai nhờ khai hộ thì thêm công ty đó.
//  - Lịch sử 01/GTGT từng quý, tách bản LẦN ĐẦU (C) và bản BỔ SUNG (B).
//
// Quy tắc cơ quan thuế (thông báo không chấp nhận Q2/2026 của chính công ty):
//   "Chỉ tiêu [22] NNT kê khai phải = Chỉ tiêu [43] trên TK lần đầu của kỳ liền kề trước"
// => [22] lấy từ bản LẦN ĐẦU. Khai bổ sung kỳ trước làm đổi [43] thì phần chênh không đưa vào [22].

import type { HoSoDN, KyKeKhai } from './types'
import type { ToKhaiDaNop } from './docToKhai'

export interface PhienBanGTGT {
  loaiTKhai: 'C' | 'B'
  soLan: number
  ngayLap: string
  ct22: number
  ct36: number
  ct40: number
  ct41: number
  ct43: number
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

export interface Kho {
  phienBan: 1
  chon: string | null
  congTy: Record<string, CongTyLuu>
  gtgt: Record<string, Record<string, PhienBanGTGT[]>>
  tncn: Record<string, Record<string, Record<string, number>>>
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
    { loaiTKhai: 'C', soLan: 0, ngayLap: '', ct22: ct.ct22, ct36: ct.ct36, ct40: ct.ct40, ct41: ct.ct41, ct43: ct.ct43, nguon: 'app', tenFile: '(app xuất, chưa nạp file đã nộp)' },
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
  ky: string // yyyy-Qn
  loaiTKhai: string
  soLan: number
  ngayLap: string
  ct: Record<string, number>
  tenFile: string
  khongChapNhan?: boolean
}

/** Gộp dữ liệu trên mây vào sổ trên máy (hợp nhất, không xoá gì của máy) */
export function gopTuMay(kho0: Kho, congTy: CongTyLuu[], toKhai: ToKhaiMay[]): Kho {
  let kho = kho0
  for (const t of toKhai) {
    const m = /^(\d{4})-Q(\d)$/.exec(t.ky)
    if (!m) continue
    const hoSo = congTy.find((c) => c.hoSo.mst === t.mst)?.hoSo ?? kho.congTy[t.mst]?.hoSo
    if (!hoSo) continue
    kho = napToKhai(kho, {
      maTKhai: t.maTKhai, loaiTKhai: t.loaiTKhai, soLan: t.soLan, ngayLap: t.ngayLap,
      ky: { quy: Number(m[2]) as 1 | 2 | 3 | 4, nam: Number(m[1]) }, hoSo, ct: t.ct, plMua: [], plBan: [], ct9: null,
    }, t.tenFile, t.id).kho
    if (t.khongChapNhan) {
      const ds = kho.gtgt[t.mst]?.[t.ky] ?? []
      const i = ds.findIndex((x) => x.ids?.includes(t.id))
      if (i >= 0) kho = datKhongChapNhan(kho, t.mst, t.ky, i, true)
    }
  }
  kho = structuredClone(kho)
  // Thông tin công ty trên mây là bản người dùng đã chốt -> ưu tiên
  for (const c of congTy) kho.congTy[c.hoSo.mst] = structuredClone(c)
  if (!kho.chon && congTy[0]) kho.chon = congTy[0].hoSo.mst
  return kho
}
