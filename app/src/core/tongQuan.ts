// TỔNG QUAN doanh nghiệp từ hồ sơ thuế: từng quý, từng năm, và các cảnh báo cần xử lý.
// Nguồn: sổ tờ khai (01/GTGT, 05/KK-TNCN), chứng từ nộp tiền, hoá đơn rút gọn.

import type { CanhBao, KyKeKhai } from './types.js'
import { tachThueSuat } from './gtgt.js'
import { denNgay, hanNop } from './ky.js'
import { khoaKy, soCai, tenKy, tinhTrangKy, type Kho, type PhienBanGTGT, type ToKhaiKhac } from './kho.js'
import { kyCuaChungTu, type ChungTu } from './taiLieu.js'

export interface TongHD {
  n: number
  v: number
  t: number
}

export interface DongQuy {
  khoa: string // 2025-Q3
  ky: KyKeKhai
  hanNop: string // dd/MM/yyyy
  quaHan: boolean
  /** Bản tờ khai đang có hiệu lực: bổ sung mới nhất, không có thì lần đầu */
  hieuLuc: PhienBanGTGT | null
  coBoSung: boolean
  biTraVe: boolean
  coTNCN: boolean
  phaiNop: number | null // [40]
  daNop: number // tổng chứng từ thuế GTGT (tiểu mục 1701) của quý
  coChungTu: boolean
  hoaDon: { ban: TongHD; mua: TongHD } | null
  khopDauKy: boolean | null
}

export interface DongNam {
  nam: number
  doanhThu: number
  muaVao: number
  thueDauRa: number
  thueDauVao: number
  phaiNop: number
  daNop: number
  soQuyCoToKhai: number
}

export interface TongQuan {
  quy: DongQuy[] // mới nhất trước
  nam: DongNam[] // mới nhất trước
  canhBao: CanhBao[]
  tuQuy: string | null
  khac: ToKhaiKhac[]
  chungTu: ChungTu[]
  /** daCoToKhai: đã nạp tờ khai ĐÃ NỘP (file XML); daXuat: app có xuất nhưng chưa thấy bản đã nộp */
  hanToi: { khoa: string; han: string; conNgay: number; daCoToKhai: boolean; daXuat: boolean } | null
}

const tuChuoi = (khoa: string): KyKeKhai => {
  const m = /^(\d{4})-Q(\d)$/.exec(khoa)!
  return { nam: Number(m[1]), quy: Number(m[2]) as 1 | 2 | 3 | 4 }
}
const sauQuy = (k: KyKeKhai): KyKeKhai => (k.quy === 4 ? { nam: k.nam + 1, quy: 1 } : { nam: k.nam, quy: (k.quy + 1) as 2 | 3 | 4 })
const ngayTu = (s: string) => {
  const [d, m, y] = s.split('/').map(Number)
  return new Date(y, m - 1, d)
}
const quyCuaNgay = (ngay: string): string | null => {
  const m = /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(ngay)
  return m ? `${m[2]}-Q${Math.ceil(Number(m[1]) / 3)}` : null
}
const tien = (n: number) => n.toLocaleString('vi-VN')

export function tinhTongQuan(kho: Kho, mst: string, homNay = new Date()): TongQuan {
  const gtgt = kho.gtgt[mst] ?? {}
  const tncn = kho.tncn[mst] ?? {}
  const chungTu = Object.values(kho.chungTu?.[mst] ?? {})
  const hoaDon = Object.values(kho.hoaDon?.[mst] ?? {})
  const khac = Object.values(kho.toKhaiKhac?.[mst] ?? {}).sort((a, b) => b.ky.localeCompare(a.ky))

  // Đã nộp theo quý (thuế GTGT, tiểu mục 1701)
  const daNop = new Map<string, number>()
  for (const ct of chungTu) for (const d of ct.dong) {
    if (d.ndkt !== '1701') continue
    const k = kyCuaChungTu(d.kyThue)
    daNop.set(k, (daNop.get(k) ?? 0) + d.tien)
  }

  // Hoá đơn còn hiệu lực theo quý
  const hdQuy = new Map<string, { ban: TongHD; mua: TongHD }>()
  for (const h of hoaDon) {
    const t = h.tt.toLowerCase()
    if (t.includes('bị thay thế') || t.includes('xóa bỏ') || t.includes('hủy bỏ') || t.includes('xoá bỏ') || t.includes('huỷ bỏ')) continue
    const k = quyCuaNgay(h.ng)
    if (!k) continue
    const g = hdQuy.get(k) ?? { ban: { n: 0, v: 0, t: 0 }, mua: { n: 0, v: 0, t: 0 } }
    g[h.l].n++
    g[h.l].v += h.v
    g[h.l].t += h.t
    hdQuy.set(k, g)
  }

  // Khoảng quý: từ quý sớm nhất có dữ liệu đến quý vừa kết thúc
  const cacQuy = [...Object.keys(gtgt), ...Object.keys(tncn), ...daNop.keys(), ...hdQuy.keys()].filter((k) => /^\d{4}-Q\d$/.test(k)).sort()
  const qNay = Math.floor(homNay.getMonth() / 3) + 1
  const quyCuoi: KyKeKhai = qNay === 1 ? { nam: homNay.getFullYear() - 1, quy: 4 } : { nam: homNay.getFullYear(), quy: (qNay - 1) as 1 | 2 | 3 }
  const cuoi = [khoaKy(quyCuoi), ...cacQuy].sort().pop()!
  const so = new Map(soCai(kho, mst).map((d) => [d.khoa, d.khop]))

  const quy: DongQuy[] = []
  if (cacQuy.length) {
    for (let k = tuChuoi(cacQuy[0]); khoaKy(k) <= cuoi; k = sauQuy(k)) {
      const khoa = khoaKy(k)
      const tt = tinhTrangKy(kho, mst, khoa)
      const hieuLuc = tt.boSungMoiNhat ?? tt.lanDau
      const tatCa = gtgt[khoa] ?? []
      const han = hanNop(k)
      quy.push({
        khoa, ky: k, hanNop: han, quaHan: homNay > ngayTu(han),
        hieuLuc, coBoSung: !!tt.boSungMoiNhat,
        biTraVe: tatCa.some((x) => x.khongChapNhan) && !hieuLuc,
        coTNCN: !!tncn[khoa],
        phaiNop: hieuLuc ? hieuLuc.ct40 : null,
        daNop: daNop.get(khoa) ?? 0,
        coChungTu: daNop.has(khoa),
        hoaDon: hdQuy.get(khoa) ?? null,
        khopDauKy: so.get(khoa) ?? null,
      })
    }
  }
  quy.reverse()

  // Theo năm
  const theoNam = new Map<number, DongNam>()
  for (const q of quy) {
    const n = theoNam.get(q.ky.nam) ?? { nam: q.ky.nam, doanhThu: 0, muaVao: 0, thueDauRa: 0, thueDauVao: 0, phaiNop: 0, daNop: 0, soQuyCoToKhai: 0 }
    if (q.hieuLuc) {
      n.doanhThu += q.hieuLuc.ct34 ?? 0
      n.muaVao += q.hieuLuc.ct23 ?? 0
      n.thueDauRa += q.hieuLuc.ct35 ?? 0
      n.thueDauVao += q.hieuLuc.ct24 ?? 0
      n.phaiNop += q.hieuLuc.ct40
      n.soQuyCoToKhai++
    }
    n.daNop += q.daNop
    theoNam.set(q.ky.nam, n)
  }

  // Cảnh báo
  const canhBao: CanhBao[] = []

  for (const q of quy) {
    const ten = tenKy(q.khoa)
    if (q.hieuLuc?.nguon === 'app') {
      canhBao.push({ muc: q.quaHan ? 'loi' : 'chu_y', noiDung: `Quý ${ten}: mới có bản APP XUẤT ([40] = ${tien(q.hieuLuc.ct40)} đ), chưa thấy tờ khai đã nộp. Nộp xong thì nạp file XML đã nộp vào để xác nhận${q.quaHan ? ` — hạn ${q.hanNop} đã qua` : ''}.` })
    } else if (q.biTraVe) canhBao.push({ muc: 'loi', noiDung: `Quý ${ten}: tờ khai 01/GTGT bị cơ quan thuế trả về, chưa thấy bản được chấp nhận.` })
    else if (!q.hieuLuc && q.quaHan) canhBao.push({ muc: 'loi', noiDung: `Quý ${ten}: chưa thấy tờ khai 01/GTGT (hạn ${q.hanNop} đã qua). Nạp file tờ khai đã nộp, hoặc nếu chưa nộp thì cần nộp ngay.` })
    if (q.khopDauKy === false) canhBao.push({ muc: 'loi', noiDung: `Quý ${ten}: [22] không bằng [43] tờ khai lần đầu quý trước — cơ quan thuế sẽ không chấp nhận.` })
    if (q.phaiNop && q.phaiNop > 0 && q.coChungTu && q.daNop < q.phaiNop) {
      canhBao.push({ muc: 'loi', noiDung: `Quý ${ten}: phải nộp ${tien(q.phaiNop)} đ nhưng chứng từ chỉ có ${tien(q.daNop)} đ — còn thiếu ${tien(q.phaiNop - q.daNop)} đ.` })
    }
    if (q.hieuLuc && q.hoaDon && q.hoaDon.ban.n > 0) {
      const lech = (q.hieuLuc.ct34 ?? 0) - q.hoaDon.ban.v
      if (Math.abs(lech) > 1000) canhBao.push({ muc: 'chu_y', noiDung: `Quý ${ten}: doanh thu trên tờ khai ${tien(q.hieuLuc.ct34 ?? 0)} đ khác tổng hoá đơn bán ra ${tien(q.hoaDon.ban.v)} đ (lệch ${tien(lech)} đ).` })
    }
  }

  // Quý có số phải nộp nhưng chưa nạp chứng từ nộp tiền: gộp 1 dòng nhắc
  const chuaCoCT = quy.filter((q) => (q.phaiNop ?? 0) > 0 && !q.coChungTu).map((q) => tenKy(q.khoa))
  if (chuaCoCT.length) {
    canhBao.push({ muc: 'chu_y', noiDung: `${chuaCoCT.length} quý có thuế phải nộp nhưng chưa nạp chứng từ nộp tiền (${chuaCoCT.join(', ')}). Tải chứng từ trên eTax (Tra cứu → Chứng từ nộp thuế) và kéo vào để app đối chiếu.` })
  }


  // Hạn nộp gần nhất: quý vừa kết thúc
  const kHan = khoaKy(quyCuoi)
  const qHan = quy.find((q) => q.khoa === kHan)
  const hanStr = hanNop(quyCuoi)
  const conNgay = Math.ceil((ngayTu(hanStr).getTime() - new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate()).getTime()) / 86400000)
  const hanToi = { khoa: kHan, han: hanStr, conNgay, daCoToKhai: qHan?.hieuLuc?.nguon === 'xml', daXuat: qHan?.hieuLuc?.nguon === 'app' }
  if (!hanToi.daCoToKhai && conNgay >= 0) canhBao.unshift({ muc: 'chu_y', noiDung: `Hạn nộp tờ khai quý ${tenKy(kHan)}: ${hanStr} (còn ${conNgay} ngày).` })

  return {
    quy,
    nam: [...theoNam.values()].sort((a, b) => b.nam - a.nam),
    canhBao,
    tuQuy: cacQuy[0] ?? null,
    khac,
    chungTu: chungTu.sort((a, b) => ngayTu(b.ngay).getTime() - ngayTu(a.ngay).getTime()),
    hanToi,
  }
}

// ---------------- ĐỐI TÁC: khách hàng (bán ra) và nhà cung cấp (mua vào) ----------------
// Hai nguồn, theo từng quý:
//  - HOÁ ĐƠN (Excel/XML): chi tiết nhất — có MST, số hoá đơn, ngày.
//  - PHỤ LỤC TỜ KHAI 01/GTGT: mục II = người mua, mục I = người bán (hàng 8%). Chỉ có tên, không có MST.
// Mỗi quý, mỗi chiều chọn MỘT nguồn (không bao giờ cộng cả hai -> không trùng):
//  - HOÁ ĐƠN nếu có danh sách Excel và đủ: các file phủ đủ 3 tháng của quý, HOẶC tổng hoá đơn không nhỏ hơn
//    phụ lục (file cũ chưa ghi được tháng phủ). Đủ thì tin hoá đơn kể cả khi tờ khai khai thừa (hoá đơn là gốc).
//  - Ngược lại (chỉ vài hoá đơn XML lẻ, hoặc Excel thiếu tháng, hoặc không có hoá đơn) -> PHỤ LỤC tờ khai.

export interface DongDoiTac {
  khoa: string
  ten: string
  mst: string
  n: number // số hoá đơn (chỉ đếm được từ hoá đơn)
  v: number // giá trị chưa thuế
  t: number // thuế
  tyTrong: number // 0..1 trên tổng cùng chiều
  cuoi: string // lần gần nhất: ngày hoá đơn, hoặc "quý 3/2025" nếu chỉ có từ tờ khai
  soQuy: number // số quý có giao dịch
  tuToKhai: boolean // có phần số liệu lấy từ phụ lục tờ khai
}

/** toKhaiThieuHD: có hoá đơn nhưng chưa đủ so với tờ khai -> đã dùng phụ lục */
export type NguonQuy = 'hoaDon' | 'toKhai' | 'toKhaiThieuHD' | 'thieu'

export interface DoiTac {
  ban: DongDoiTac[]
  mua: DongDoiTac[]
  tongBan: number
  tongMua: number
  /** Từng quý trong khoảng: lấy đối tác từ nguồn nào; thangThieu = tháng chưa có danh sách hoá đơn */
  nguonQuy: { khoa: string; ban: NguonQuy; mua: NguonQuy; thangThieu?: { ban: string[]; mua: string[] } }[]
}

// Chữ viết tắt hay gặp trong tên doanh nghiệp (phụ lục tờ khai hay viết tắt, hoá đơn thì viết đủ).
// So khớp theo TỪ NGUYÊN VẸN (tách bằng dấu cách) — không đổi nhầm chữ nằm trong từ khác (vd "VNG", "STM").
const VIET_TAT: Record<string, string> = {
  CTY: 'CÔNG TY',
  CP: 'CỔ PHẦN',
  MTV: 'MỘT THÀNH VIÊN',
  TM: 'THƯƠNG MẠI',
  DV: 'DỊCH VỤ',
  SX: 'SẢN XUẤT',
  XD: 'XÂY DỰNG',
  XNK: 'XUẤT NHẬP KHẨU',
}
export const chuanTen = (s: string) =>
  s
    .normalize('NFC')
    .toUpperCase()
    .replace(/[.,;:()"'“”&-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((tu) => VIET_TAT[tu] ?? tu)
    .join(' ')
const soNgay = (s: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s)
  return m ? Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]) : 0
}
const laHuy = (tt: string) => {
  const t = tt.toLowerCase()
  return t.includes('bị thay thế') || t.includes('xóa bỏ') || t.includes('hủy bỏ') || t.includes('xoá bỏ') || t.includes('huỷ bỏ')
}

/** `nam` = null: tất cả các năm */
export function tinhDoiTac(kho: Kho, mst: string, nam: number | null): DoiTac {
  const tatCaHD = Object.values(kho.hoaDon?.[mst] ?? {}).filter((h) => !laHuy(h.tt))
  const trongNam = (khoaQuy: string) => nam === null || khoaQuy.startsWith(`${nam}-`)

  // Tên -> MST, học từ mọi hoá đơn có MST đối tác (để phụ lục tờ khai, vốn không có MST, gộp đúng đối tác)
  const mstTheoTen = new Map<string, string>()
  for (const h of tatCaHD) {
    const m = h.l === 'ban' ? h.mm : h.mb
    if (m) mstTheoTen.set(chuanTen(h.ten), m)
  }

  // Hoá đơn theo quý + chiều
  const hdTheoQuy = new Map<string, typeof tatCaHD>()
  for (const h of tatCaHD) {
    const q = quyCuaNgay(h.ng)
    if (!q || !trongNam(q)) continue
    const k = `${q}|${h.l}`
    hdTheoQuy.set(k, [...(hdTheoQuy.get(k) ?? []), h])
  }

  type Nhom = DongDoiTac & { quy: Set<string>; ngayCuoi: number }
  const nhom = { ban: new Map<string, Nhom>(), mua: new Map<string, Nhom>() }
  const them = (l: 'ban' | 'mua', ten: string, mstDT: string, v: number, t: number, q: string, ngay: string, laHD: boolean) => {
    const m = mstDT || mstTheoTen.get(chuanTen(ten)) || ''
    const khoa = m || chuanTen(ten)
    const g: Nhom = nhom[l].get(khoa) ?? { khoa, ten, mst: m, n: 0, v: 0, t: 0, tyTrong: 0, cuoi: '', soQuy: 0, tuToKhai: false, quy: new Set(), ngayCuoi: 0 }
    if (laHD) g.n++
    else g.tuToKhai = true
    g.v += v
    g.t += t
    g.quy.add(q)
    const sn = laHD ? soNgay(ngay) : soNgay(denNgay(tuChuoi(q)))
    if (sn >= g.ngayCuoi) {
      g.ngayCuoi = sn
      g.cuoi = laHD ? ngay : `quý ${tenKy(q)}`
      g.ten = ten
    }
    nhom[l].set(khoa, g)
  }

  const nguonQuy: DoiTac['nguonQuy'] = []
  const cacQuy = new Set(
    [...Object.keys(kho.gtgt[mst] ?? {}), ...[...hdTheoQuy.keys()].map((k) => k.split('|')[0])].filter((k) => /^\d{4}-Q\d$/.test(k) && trongNam(k)),
  )
  for (const k of [...cacQuy].sort()) {
    const tt = tinhTrangKy(kho, mst, k)
    const pb = tt.boSungMoiNhat ?? tt.lanDau
    const ng: DoiTac['nguonQuy'][number] = { khoa: k, ban: 'thieu', mua: 'thieu' }
    const ky = tuChuoi(k)
    const thangQuy = [0, 1, 2].map((i) => `${ky.nam}-${String((ky.quy - 1) * 3 + 1 + i).padStart(2, '0')}`)
    for (const l of ['ban', 'mua'] as const) {
      const dsHD = hdTheoQuy.get(`${k}|${l}`) ?? []
      const pl = l === 'ban' ? (pb?.plBan ?? []).map((d) => ({ ten: d.ten, v: d.giaTri, t: d.thueGiam * 4 })) : (pb?.plMua ?? []).map((d) => ({ ten: d.ten, v: d.giaTri, t: d.thue }))
      const coDanhSach = dsHD.some((h) => !h.x)
      const phu = kho.phuSong?.[mst]?.[l] ?? []
      const thieuThang = thangQuy.filter((t) => !phu.includes(t))
      const tongHD = dsHD.reduce((s, h) => s + h.v, 0)
      const tongPL = pl.reduce((s, d) => s + d.v, 0)
      const du = coDanhSach && (thieuThang.length === 0 || tongHD >= tongPL - 1000)
      if (du || (dsHD.length && !pl.length)) {
        ng[l] = 'hoaDon'
        for (const h of dsHD) them(l, h.ten, l === 'ban' ? h.mm ?? '' : h.mb, h.v, h.t, k, h.ng, true)
      } else if (pl.length) {
        // thuế bán ra 8% của dòng = 4 × số thuế được giảm 2% (đúng theo cách lập phụ lục)
        ng[l] = dsHD.length ? 'toKhaiThieuHD' : 'toKhai'
        if (dsHD.length && thieuThang.length) (ng.thangThieu ??= { ban: [], mua: [] })[l] = thieuThang
        for (const d of pl) them(l, d.ten, '', d.v, d.t, k, '', false)
      }
    }
    nguonQuy.push(ng)
  }

  const xep = (l: 'ban' | 'mua') => {
    const ds = [...nhom[l].values()]
    const tong = ds.reduce((s, g) => s + g.v, 0)
    return {
      tong,
      kq: ds.map(({ quy, ngayCuoi, ...g }) => (void ngayCuoi, { ...g, soQuy: quy.size, tyTrong: tong ? g.v / tong : 0 })).sort((a, b) => b.v - a.v),
    }
  }
  const b = xep('ban')
  const m = xep('mua')
  return { ban: b.kq, mua: m.kq, tongBan: b.tong, tongMua: m.tong, nguonQuy }
}

// ---------------- ĐỐI SOÁT tờ khai ↔ hoá đơn (để kiểm dữ liệu đã nạp có chuẩn không) ----------------

export interface HoaDonNgan {
  kh: string
  so: string
  ng: string
  v: number
  t: number
  tt: string
}

export interface DongDoiSoatDT {
  l: 'ban' | 'mua'
  ten: string
  mst: string
  hd: number // giá trị chịu thuế 8% theo hoá đơn
  pl: number // giá trị trên phụ lục tờ khai
  lech: number // hd - pl
  hoaDon: HoaDonNgan[]
}

export interface DoiSoatChieu {
  tk: number | null // [34] (bán) / [23] (mua) trên tờ khai đang hiệu lực
  hd: number // tổng hoá đơn còn hiệu lực
  n: number
  lech: number | null // hd - tk
  thangCo: string[] // tháng trong quý đã có danh sách hoá đơn
}

export interface DoiSoatQuy {
  khoa: string
  ban: DoiSoatChieu
  mua: DoiSoatChieu
  /** Đối tác lệch giữa phụ lục tờ khai và hoá đơn (chỉ so khi tờ khai có phụ lục chiều đó) */
  doiTac: DongDoiSoatDT[]
}

export function tinhDoiSoat(kho: Kho, mst: string): DoiSoatQuy[] {
  const tatCaHD = Object.values(kho.hoaDon?.[mst] ?? {}).filter((h) => !laHuy(h.tt))
  const mstTheoTen = new Map<string, string>()
  for (const h of tatCaHD) {
    const m = h.l === 'ban' ? h.mm : h.mb
    if (m) mstTheoTen.set(chuanTen(h.ten), m)
  }
  const khoaDT = (ten: string, m?: string) => m || mstTheoTen.get(chuanTen(ten)) || chuanTen(ten)
  const cacQuy = new Set([...Object.keys(kho.gtgt[mst] ?? {}), ...tatCaHD.map((h) => quyCuaNgay(h.ng)).filter((q): q is string => !!q)])
  const kq: DoiSoatQuy[] = []
  for (const k of [...cacQuy].filter((x) => /^\d{4}-Q\d$/.test(x)).sort().reverse()) {
    const tt = tinhTrangKy(kho, mst, k)
    const pb = tt.boSungMoiNhat ?? tt.lanDau
    const ky = tuChuoi(k)
    const thangQuy = [0, 1, 2].map((i) => `${ky.nam}-${String((ky.quy - 1) * 3 + 1 + i).padStart(2, '0')}`)
    const dsQuy = tatCaHD.filter((h) => quyCuaNgay(h.ng) === k)
    const chieu = (l: 'ban' | 'mua'): DoiSoatChieu => {
      const ds = dsQuy.filter((h) => h.l === l)
      const hd = ds.reduce((s, h) => s + h.v, 0)
      const tk = pb ? ((l === 'ban' ? pb.ct34 : pb.ct23) ?? null) : null
      return { tk, hd, n: ds.length, lech: tk === null || !ds.length ? null : hd - tk, thangCo: thangQuy.filter((t) => (kho.phuSong?.[mst]?.[l] ?? []).includes(t)) }
    }
    // Đối tác: phần chịu thuế 8% trên hoá đơn so với phụ lục (phụ lục chỉ kê hàng 8%)
    const doiTac: DongDoiSoatDT[] = []
    for (const l of ['ban', 'mua'] as const) {
      const pl = l === 'ban' ? pb?.plBan : pb?.plMua
      const ds = dsQuy.filter((h) => h.l === l)
      if (!pl?.length || !ds.length) continue
      const nhom = new Map<string, DongDoiSoatDT>()
      const lay = (key: string, ten: string, m: string) => {
        const g = nhom.get(key) ?? { l, ten, mst: m, hd: 0, pl: 0, lech: 0, hoaDon: [] }
        if (!g.mst && m) g.mst = m
        nhom.set(key, g)
        return g
      }
      for (const h of ds) {
        const m = (l === 'ban' ? h.mm : h.mb) ?? ''
        const g = lay(khoaDT(h.ten, m), h.ten, m)
        g.hd += tachThueSuat(h.v, h.t).v8
        g.hoaDon.push({ kh: h.kh, so: h.so, ng: h.ng, v: h.v, t: h.t, tt: h.tt })
      }
      for (const d of pl) lay(khoaDT(d.ten), d.ten, '').pl += d.giaTri
      for (const g of nhom.values()) {
        g.lech = g.hd - g.pl
        if (Math.abs(g.lech) > 1000) doiTac.push(g)
      }
    }
    kq.push({ khoa: k, ban: chieu('ban'), mua: chieu('mua'), doiTac: doiTac.sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech)) })
  }
  return kq
}
