// TỔNG QUAN doanh nghiệp từ hồ sơ thuế: từng quý, từng năm, và các cảnh báo cần xử lý.
// Nguồn: sổ tờ khai (01/GTGT, 05/KK-TNCN), chứng từ nộp tiền, hoá đơn rút gọn.

import type { CanhBao, KyKeKhai } from './types'
import { hanNop } from './ky'
import { khoaKy, soCai, tenKy, tinhTrangKy, type Kho, type PhienBanGTGT, type ToKhaiKhac } from './kho'
import { kyCuaChungTu, type ChungTu } from './taiLieu'

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
