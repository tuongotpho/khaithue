// NGHIỆM THU: đưa Excel hoá đơn thật của các quý đã nộp vào app, so từng chỉ tiêu với XML đã nộp.
// Dữ liệu thật + danh sách ca nằm ở du-lieu-rieng/doi-chieu.json (KHÔNG đưa lên git).
// Máy không có file đó (vd. GitHub, Vercel) thì test tự bỏ qua.

import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { docTep, gopHoaDon, phanLoai, type TepHoaDon } from './excel'
import { tinhGTGT, NHAP_TAY_TRONG } from './gtgt'
import { docToKhai } from './docToKhai'
import { khoTrong, napToKhai, soCai } from './kho'
import type { KyKeKhai } from './types'

XLSX.set_fs(fs)

interface Ca {
  ten: string
  thuMuc: string
  ky: KyKeKhai
  xml: string
  /** Phụ lục mục I khai tay khác quy tắc — ghi rõ lý do; ngoài các ca này phải khớp tuyệt đối */
  lechPhuLucMua?: string
  /** Hoá đơn ngoài quý mà người khai đã đưa vào (theo số hoá đơn) */
  kemNgoaiKy?: string[]
  /** Chỉ tiêu tờ khai đã nộp SAI — app phải ra số đúng này */
  soDung?: { lyDo: string; ct: Record<string, number> }
}

const FILE_CA = path.resolve(__dirname, '../../../du-lieu-rieng/doi-chieu.json')
const cfg: { goc: string; mst: string; quy: Ca[] } | null =
  fs.existsSync(FILE_CA) ? JSON.parse(fs.readFileSync(FILE_CA, 'utf8')) : null
const coDuLieu = !!cfg && fs.existsSync(cfg.goc)

function docExcelTrongThuMuc(dir: string): TepHoaDon[] {
  const ds: TepHoaDon[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!/\.xlsx?$/i.test(f)) continue
    const wb = XLSX.readFile(path.join(dir, f))
    for (const ten of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[ten], { header: 1, raw: true, defval: null })
      const t = docTep(rows as never, `${f}#${ten}`)
      if (t) ds.push(t)
    }
  }
  return ds
}

const CHI_TIEU = ['ct21', 'ct22', 'ct23', 'ct24', 'ct23a', 'ct24a', 'ct25', 'ct26', 'ct27', 'ct28', 'ct29', 'ct30', 'ct31', 'ct32', 'ct33', 'ct32a', 'ct34', 'ct35', 'ct36', 'ct37', 'ct38', 'ct39a', 'ct40a', 'ct40b', 'ct40', 'ct41', 'ct42', 'ct43']

describe.skipIf(!coDuLieu)('Đối chiếu với tờ khai 01/GTGT đã nộp', () => {
  for (const q of cfg?.quy ?? []) {
    it(q.ten, () => {
      const dir = path.join(cfg!.goc, q.thuMuc)
      const daNop = docToKhai(fs.readFileSync(path.join(dir, q.xml), 'utf8'))
      // KHÔNG cho app biết MST: app phải tự nhận ra công ty và tự xếp bán ra / mua vào
      const pl = phanLoai(docExcelTrongThuMuc(dir), null)
      if (pl.mst) expect(pl.mst).toBe(cfg!.mst)
      expect(pl.canhBao).toEqual([])
      const gop = gopHoaDon(pl.hoaDon, q.ky)
      const kem = gop.ngoaiKy.filter((h) => q.kemNgoaiKy?.includes(h.so))
      expect(kem.length).toBe(q.kemNgoaiKy?.length ?? 0)
      const { toKhai } = tinhGTGT(gop.ban, [...gop.mua, ...kem], { ...NHAP_TAY_TRONG, ct22: daNop.ct.ct22 })

      // 1) Tờ khai chính: khớp tuyệt đối từng chỉ tiêu
      const app = Object.fromEntries(CHI_TIEU.map((k) => [k, toKhai.ct[k]]))
      const that = Object.fromEntries(CHI_TIEU.map((k) => [k, q.soDung?.ct[k] ?? daNop.ct[k]]))
      expect(app).toEqual(that)

      // 2) Phụ lục mục II (bán ra, số thuế được giảm): khớp tuyệt đối
      const sx = <T extends { ten: string }>(a: T[]) => [...a].sort((x, y) => x.ten.localeCompare(y.ten))
      expect(sx(toKhai.plBan.map((d) => ({ ten: d.ten.toUpperCase(), giaTri: d.giaTri, thueGiam: d.thueGiam }))))
        .toEqual(sx(daNop.plBan.map((d) => ({ ...d, ten: d.ten.toUpperCase() }))))

      // 3) Phụ lục mục I (mua vào 8%): khớp tuyệt đối, trừ các quý đã ghi rõ lý do lệch
      const muaApp = sx(toKhai.plMua.map(({ ten, giaTri, thue }) => ({ ten, giaTri, thue })))
      const muaThat = sx(daNop.plMua.filter((d) => d.ten))
      if (q.lechPhuLucMua) expect(muaApp).not.toEqual(muaThat)
      else expect(muaApp).toEqual(muaThat)

      // 4) [09] = [08] − [06]
      expect(toKhai.ct9).toBe(toKhai.tongPlBan.thueGiam - toKhai.tongPlMua.thue)
    })
  }

  it('Sổ theo dõi: nạp mọi tờ khai XML đã lưu -> chuỗi đầu kỳ – cuối kỳ', () => {
    let kho = khoTrong()
    const tim = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? tim(path.join(d, e.name)) : /\.xml$/i.test(e.name) ? [path.join(d, e.name)] : [])
    for (const f of ['2024', '2025', '2026'].flatMap((n) => (fs.existsSync(path.join(cfg!.goc, n)) ? tim(path.join(cfg!.goc, n)) : []))) {
      const xml = fs.readFileSync(f, 'utf8')
      if (!/<maTKhai>(842|864)<\/maTKhai>/.test(xml)) continue
      kho = napToKhai(kho, docToKhai(xml), path.basename(f)).kho
    }
    expect(kho.chon).toBe(cfg!.mst)
    const so = soCai(kho, cfg!.mst)
    expect(so.length).toBeGreaterThanOrEqual(8)
    // Theo các file đang lưu, chuỗi liền mạch (lỗi Q2/2026 là do bản lần đầu Q1 cơ quan thuế ghi nhận khác file này)
    expect(so.filter((d) => d.khop === false)).toEqual([])
  })
})

import { docTaiLieu } from './taiLieu'
import { napHoaDon, napTaiLieu } from './kho'
import { tinhTongQuan } from './tongQuan'

interface CaTongQuan {
  homNay: string
  tuQuy: string
  daNopBangPhaiNop: string[]
  doanhThuKhopHoaDon: string[]
  lechDoanhThu: Record<string, number>
}
const caTQ = (cfg as unknown as { tongQuan?: CaTongQuan } | null)?.tongQuan

describe.skipIf(!coDuLieu || !caTQ)('Tổng quan dựng từ toàn bộ hồ sơ thật', () => {
  it('đọc hết mọi file, phải nộp = đã nộp, doanh thu tờ khai = hoá đơn', () => {
    const tim = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? tim(path.join(d, e.name)) : [path.join(d, e.name)])
    const files = ['2024', '2025', '2026'].flatMap((n) => (fs.existsSync(path.join(cfg!.goc, n)) ? tim(path.join(cfg!.goc, n)) : []))
    let kho = khoTrong()
    const loi: string[] = []
    for (const f of files.filter((x) => /\.xml$/i.test(x))) {
      const r = napTaiLieu(kho, docTaiLieu(fs.readFileSync(f, 'utf8')), path.basename(f))
      kho = r.kho
      if (r.loi) loi.push(`${path.basename(f)}: ${r.moTa}`)
    }
    expect(loi).toEqual([]) // không file XML nào bị bỏ sót
    const teps = files.filter((x) => /\.xlsx?$/i.test(x)).flatMap((f) => {
      const wb = XLSX.readFile(f)
      return wb.SheetNames.map((s) => docTep(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, raw: true, defval: null }) as never, `${f}#${s}`)).filter((t): t is TepHoaDon => !!t)
    })
    const pl = phanLoai(teps, cfg!.mst)
    kho = napHoaDon(kho, cfg!.mst, pl.hoaDon)

    const tq = tinhTongQuan(kho, cfg!.mst, new Date(caTQ!.homNay))
    expect(tq.tuQuy).toBe(caTQ!.tuQuy)
    const q = new Map(tq.quy.map((x) => [x.khoa, x]))
    for (const k of caTQ!.daNopBangPhaiNop) expect(q.get(k)!.daNop, k).toBe(q.get(k)!.phaiNop)
    for (const k of caTQ!.doanhThuKhopHoaDon) expect(q.get(k)!.hieuLuc!.ct34, k).toBe(q.get(k)!.hoaDon!.ban.v)
    for (const [k, lech] of Object.entries(caTQ!.lechDoanhThu)) expect((q.get(k)!.hieuLuc!.ct34 ?? 0) - q.get(k)!.hoaDon!.ban.v, k).toBe(lech)
    expect(tq.quy.every((x) => x.khopDauKy !== false)).toBe(true)
  })
})
