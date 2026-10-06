// Tính tờ khai 01/GTGT (TT80/2021) kèm phụ lục giảm thuế GTGT (NQ142 / NQ204, mức 10% -> 8%)
// Công thức đã đối chiếu với các tờ khai HTKK đã nộp thật của công ty (xem test).

import type { CanhBao, DongPhuLucBan, DongPhuLucMua, HoaDon, ToKhaiGTGT } from './types.js'

/** Phần giá trị/thuế của một hoá đơn theo từng thuế suất */
export interface TachThueSuat {
  v0: number
  v5: number
  t5: number
  v8: number
  t8: number
  v10: number
  t10: number
  /** Hoá đơn có nhiều thuế suất lẫn nhau, phải tự tách — cần người xem lại */
  tronLan: boolean
  khongRo: boolean
}

const gan = (tyLe: number, muc: number, dungSai: number) => Math.abs(tyLe - muc) <= dungSai

/**
 * File Excel chỉ có tổng tiền của cả hoá đơn, không có từng dòng hàng.
 * Suy ra thuế suất từ tỷ lệ thuế / giá trị. Hoá đơn lẫn 2 thuế suất thì tách theo phép tính.
 */
export function tachThueSuat(V: number, T: number): TachThueSuat {
  const kq: TachThueSuat = { v0: 0, v5: 0, t5: 0, v8: 0, t8: 0, v10: 0, t10: 0, tronLan: false, khongRo: false }
  if (V === 0) {
    if (T !== 0) {
      kq.v10 = 0
      kq.t10 = T
      kq.khongRo = true
    }
    return kq
  }
  const tyLe = T / V
  // Mỗi dòng hàng được làm tròn thuế riêng nên cho phép sai lệch nhỏ
  const dungSai = Math.max(10 / Math.abs(V), 0.0002)
  if (T === 0) kq.v0 = V
  else if (gan(tyLe, 0.08, dungSai)) Object.assign(kq, { v8: V, t8: T })
  else if (gan(tyLe, 0.1, dungSai)) Object.assign(kq, { v10: V, t10: T })
  else if (gan(tyLe, 0.05, dungSai)) Object.assign(kq, { v5: V, t5: T })
  else if (tyLe > 0.08 && tyLe < 0.1) {
    // Lẫn 8% và 10%: v8 + v10 = V ; 8%·v8 + 10%·v10 = T
    const v10 = Math.round((T - 0.08 * V) / 0.02)
    const v8 = V - v10
    const t8 = Math.round(v8 * 0.08)
    Object.assign(kq, { v8, t8, v10, t10: T - t8, tronLan: true })
  } else if (tyLe > 0 && tyLe < 0.08) {
    // Lẫn 0% (hoặc không chịu thuế) và 8%
    const v8 = Math.round(T / 0.08)
    Object.assign(kq, { v8, t8: T, v0: V - v8, tronLan: true })
  } else {
    Object.assign(kq, { v10: V, t10: T, khongRo: true })
  }
  return kq
}

/** Các chỉ tiêu người khai tự nhập (không có trong hoá đơn) */
export interface NhapTayGTGT {
  ct21: boolean // không phát sinh hoạt động mua bán trong kỳ
  ct22: number // thuế còn được khấu trừ kỳ trước chuyển sang (= [43] quý trước)
  ct23a: number
  ct24a: number
  ct26: number // doanh thu không chịu thuế
  ct32a: number
  ct37: number
  ct38: number
  ct39a: number
  ct40b: number
  ct42: number
}

export const NHAP_TAY_TRONG: NhapTayGTGT = {
  ct21: false, ct22: 0, ct23a: 0, ct24a: 0, ct26: 0, ct32a: 0, ct37: 0, ct38: 0, ct39a: 0, ct40b: 0, ct42: 0,
}

/** Sửa tay một dòng phụ lục mua vào (theo MST người bán) */
export type SuaPhuLucMua = Record<string, { giaTri: number; thue: number }>

export interface KetQuaGTGT {
  toKhai: ToKhaiGTGT
  canhBao: CanhBao[]
}

function gomNhom<T extends { mst: string; ten: string }>(ds: T[], cong: (a: T, b: T) => void): T[] {
  const m = new Map<string, T>()
  for (const d of ds) {
    const k = d.mst || d.ten
    const co = m.get(k)
    if (co) cong(co, d)
    else m.set(k, { ...d })
  }
  return [...m.values()]
}

const tienVN = (n: number) => n.toLocaleString('vi-VN')

export function tinhGTGT(
  ban: HoaDon[],
  mua: HoaDon[],
  nhap: NhapTayGTGT = NHAP_TAY_TRONG,
  suaMua: SuaPhuLucMua = {},
): KetQuaGTGT {
  const canhBao: CanhBao[] = []
  const tenHD = (h: HoaDon) => `HĐ ${h.kyHieu}-${h.so} ngày ${h.ngay} (${h.loai === 'ban' ? h.tenMua : h.tenBan})`

  // ---- Bán ra ----
  let ct29 = 0, ct30 = 0, ct31 = 0, ct32 = 0
  const banGiam: DongPhuLucBan[] = []
  for (const h of ban) {
    const t = tachThueSuat(h.chuaThue, h.thue)
    if (t.tronLan) canhBao.push({ muc: 'chu_y', noiDung: `${tenHD(h)} có nhiều thuế suất, app đã tự tách: phần 8% = ${tienVN(t.v8)} đ. Kiểm tra lại.` })
    if (t.khongRo) canhBao.push({ muc: 'chu_y', noiDung: `${tenHD(h)}: không nhận ra thuế suất (giá trị ${tienVN(h.chuaThue)}, thuế ${tienVN(h.thue)}). Đang tạm tính vào dòng 10% — kiểm tra lại.` })
    if (t.v0) canhBao.push({ muc: 'chu_y', noiDung: `${tenHD(h)}: hoá đơn bán ra thuế 0 đ — đang tính vào chỉ tiêu [29] (thuế suất 0%). Nếu là hàng không chịu thuế thì nhập vào [26].` })
    ct29 += t.v0
    ct30 += t.v5
    ct31 += t.t5
    ct32 += t.v8 + t.v10
    if (t.v8) banGiam.push({ mst: h.mstMua, ten: h.tenMua, giaTri: t.v8, thueSuat: 10, thueSuatSauGiam: 8, thueGiam: 0 })
  }
  const plBan = gomNhom(banGiam, (a, b) => { a.giaTri += b.giaTri })
  for (const d of plBan) d.thueGiam = Math.round(d.giaTri * 0.02)
  const tongGiam = plBan.reduce((s, d) => s + d.thueGiam, 0)
  // HTKK: thuế dòng [33] = 10% doanh thu − số thuế được giảm ở phụ lục
  const ct33 = Math.round(ct32 * 0.1) - tongGiam
  const thueTrenHD = ban.reduce((s, h) => s + h.thue, 0) - ct31
  if (Math.abs(thueTrenHD - ct33) > 5) {
    canhBao.push({ muc: 'chu_y', noiDung: `Thuế bán ra theo công thức [33] = ${tienVN(ct33)} đ, cộng trên hoá đơn = ${tienVN(thueTrenHD)} đ (lệch ${tienVN(thueTrenHD - ct33)} đ).` })
  }

  // ---- Mua vào ----
  let ct23 = 0, ct24 = 0
  const muaTam: DongPhuLucMua[] = []
  for (const h of mua) {
    ct23 += h.chuaThue
    ct24 += h.thue
    const t = tachThueSuat(h.chuaThue, h.thue)
    if (t.tronLan) canhBao.push({ muc: 'chu_y', noiDung: `${tenHD(h)} có nhiều thuế suất. Phụ lục mục I chỉ kê phần 8%, app tự tách được: giá trị ${tienVN(t.v8)} đ, thuế ${tienVN(t.t8)} đ. Kiểm tra lại.` })
    if (t.khongRo) canhBao.push({ muc: 'chu_y', noiDung: `${tenHD(h)}: không nhận ra thuế suất (giá trị ${tienVN(h.chuaThue)}, thuế ${tienVN(h.thue)}) — không đưa vào phụ lục mục I, kiểm tra lại.` })
    if (t.v8) muaTam.push({ mst: h.mstBan, ten: h.tenBan, giaTri: t.v8, thue: t.t8 })
  }
  const plMua = gomNhom(muaTam, (a, b) => { a.giaTri += b.giaTri; a.thue += b.thue })
  for (const d of plMua) {
    const s = suaMua[d.mst || d.ten]
    if (s) Object.assign(d, s)
  }

  const tongPlMua = { giaTri: plMua.reduce((s, d) => s + d.giaTri, 0), thue: plMua.reduce((s, d) => s + d.thue, 0) }
  const tongPlBan = { giaTri: plBan.reduce((s, d) => s + d.giaTri, 0), thueGiam: tongGiam }

  // ---- Các chỉ tiêu tổng hợp ----
  const ct25 = ct24 + nhap.ct24a
  const ct27 = ct29 + ct30 + ct32 + nhap.ct32a
  const ct28 = ct31 + ct33
  const ct34 = nhap.ct26 + ct27
  const ct35 = ct28
  const ct36 = ct35 - ct25
  const x = ct36 - nhap.ct22 + nhap.ct37 - nhap.ct38 - nhap.ct39a
  const ct40a = x > 0 ? x : 0
  const ct40 = Math.max(ct40a - nhap.ct40b, 0)
  const ct41 = x < 0 ? -x : 0
  const ct43 = ct41 - nhap.ct42

  if (nhap.ct42 > ct41) canhBao.push({ muc: 'loi', noiDung: '[42] đề nghị hoàn lớn hơn [41] số thuế chưa khấu trừ hết.' })
  if (nhap.ct21 && (ban.length || mua.length)) canhBao.push({ muc: 'loi', noiDung: 'Đã đánh dấu [21] "không phát sinh" nhưng vẫn có hoá đơn.' })

  const ct: Record<string, number> = {
    ct21: nhap.ct21 ? 1 : 0,
    ct22: nhap.ct22,
    ct23, ct24,
    ct23a: nhap.ct23a, ct24a: nhap.ct24a,
    ct25,
    ct26: nhap.ct26,
    ct27, ct28,
    ct29,
    ct30, ct31,
    ct32, ct33,
    ct32a: nhap.ct32a,
    ct34, ct35, ct36,
    ct37: nhap.ct37, ct38: nhap.ct38, ct39a: nhap.ct39a,
    ct40a, ct40b: nhap.ct40b, ct40,
    ct41, ct42: nhap.ct42, ct43,
  }

  return {
    toKhai: { ct, plMua, plBan, tongPlMua, tongPlBan, ct9: tongGiam - tongPlMua.thue },
    canhBao,
  }
}

/**
 * Bảo vệ "đầu kỳ – cuối kỳ". Quy tắc cơ quan thuế (nguyên văn thông báo không chấp nhận):
 *   "Chỉ tiêu [22] NNT kê khai phải = Chỉ tiêu [43] trên TK lần đầu của kỳ liền kề trước"
 * `ct43LanDau` = [43] trên tờ khai LẦN ĐẦU quý trước (không phải bản bổ sung).
 */
export function kiemDauKy(ct22: number, ct43LanDau: number | null, tenKyTruoc: string, chenhBoSung = 0): CanhBao[] {
  const kq: CanhBao[] = []
  if (ct43LanDau === null) {
    kq.push({ muc: 'chu_y', noiDung: `Chưa có tờ khai LẦN ĐẦU quý ${tenKyTruoc} để kiểm [22]${ct22 ? ` = ${tienVN(ct22)} đ` : ''}. Kéo file XML 01/GTGT quý ${tenKyTruoc} (bản lần đầu đã được cơ quan thuế chấp nhận) vào bước 1.` })
  } else if (ct22 !== ct43LanDau) {
    kq.push({ muc: 'loi', noiDung: `ĐẦU KỲ – CUỐI KỲ KHÔNG KHỚP: [22] = ${tienVN(ct22)} đ nhưng [43] tờ khai lần đầu quý ${tenKyTruoc} = ${tienVN(ct43LanDau)} đ. Cơ quan thuế sẽ KHÔNG chấp nhận tờ khai ("[22] phải = [43] trên TK lần đầu của kỳ liền kề trước").` })
  }
  if (chenhBoSung !== 0) {
    kq.push({
      muc: 'chu_y',
      noiDung: `Quý ${tenKyTruoc} có khai bổ sung làm [43] ${chenhBoSung < 0 ? 'giảm' : 'tăng'} ${tienVN(Math.abs(chenhBoSung))} đ. KHÔNG sửa [22]; phần chênh này thường khai ở ${chenhBoSung < 0 ? '[37] điều chỉnh giảm' : '[38] điều chỉnh tăng'} của quý này — xác nhận với cán bộ thuế trước khi điền.`,
    })
  }
  return kq
}
