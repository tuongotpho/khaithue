// Kiểm máy chủ MCP từ đầu tới cuối, như một AI thật gọi vào: dựng thư mục hồ sơ giả (tờ khai XML quý 1
// + Excel hoá đơn quý 2), nối client MCP vào máy chủ, gọi từng công cụ và soát con số.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { tinhGTGT } from '../src/core/gtgt.js'
import { xmlGTGT } from '../src/core/xml.js'
import type { HoaDon, HoSoDN } from '../src/core/types.js'
import { taoMayChu } from './mayChu.js'
import { nguonThuMuc } from './nguon.js'

XLSX.set_fs(fs)

const MST = '0109999999'
const hoSo: HoSoDN = {
  mst: MST, tenNNT: 'Công ty TNHH Thử Nghiệm', dchiNNT: 'Số 1', phuongXa: 'Phường A', maXaNNT: '00001', maTinhNNT: '25',
  tenTinhNNT: 'Phú Thọ', dthoaiNNT: '', emailNNT: '', maCQTNoiNop: '12345', tenCQTNoiNop: 'Thuế cơ sở 1', nguoiKy: 'Nguyễn Văn A',
}
const hd = (o: Partial<HoaDon>): HoaDon => ({
  loai: 'mua', kyHieuMau: '1', kyHieu: 'C26TAA', so: '1', ngay: '15/02/2026', mstBan: '0200000002', tenBan: 'NCC', mstMua: MST, tenMua: hoSo.tenNNT,
  chuaThue: 0, thue: 0, trangThai: 'Hóa đơn mới', file: '', ...o,
})

let goc: string
let client: Client

async function goi(ten: string, args: Record<string, unknown> = {}) {
  const r = await client.callTool({ name: ten, arguments: args })
  const text = (r.content as { text: string }[])[0].text
  return { loi: !!r.isError, kq: JSON.parse(text) }
}

beforeAll(async () => {
  goc = fs.mkdtempSync(path.join(os.tmpdir(), 'khaithue-mcp-'))
  fs.mkdirSync(path.join(goc, 'xml'))
  fs.mkdirSync(path.join(goc, 'excel'))
  // Quý 1/2026 đã nộp: chỉ có mua vào -> [43] = 5.000 chuyển sang quý 2
  const q1 = tinhGTGT([], [hd({ chuaThue: 50000, thue: 5000 })]).toKhai
  fs.writeFileSync(path.join(goc, 'xml', `${MST}000-01_GTGT_TT80-Q12026-L00.xml`), xmlGTGT(q1, { quy: 1, nam: 2026 }, hoSo, '2026-04-20'))
  // Quý 2/2026: Excel "Danh sách hoá đơn" lẫn cả bán ra (10% và 8%) lẫn mua vào, thêm 1 hoá đơn bị thay thế
  const rows = [
    ['DANH SÁCH HÓA ĐƠN'],
    ['Từ ngày 01/04/2026 đến ngày 30/06/2026'],
    ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán', 'Tên người bán', 'MST người mua', 'Tên người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Trạng thái hóa đơn'],
    [1, '1', 'C26TNA', '1', '10/04/2026', MST, hoSo.tenNNT, '0100000001', 'Khách Mười', 100000000, 10000000, 'Hóa đơn mới'],
    [2, '1', 'C26TNA', '2', '20/05/2026', MST, hoSo.tenNNT, '0100000003', 'Khách Tám', 50000000, 4000000, 'Hóa đơn mới'],
    [3, '1', 'C26TBB', '7', '05/06/2026', '0200000002', 'Nhà Cung Cấp', MST, hoSo.tenNNT, 30000000, 3000000, 'Hóa đơn mới'],
    [4, '1', 'C26TBB', '6', '01/06/2026', '0200000002', 'Nhà Cung Cấp', MST, hoSo.tenNNT, 99000000, 9900000, 'Hóa đơn bị thay thế'],
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
  XLSX.writeFile(wb, path.join(goc, 'excel', 'DANH SÁCH HÓA ĐƠN.xlsx'))

  const server = taoMayChu(nguonThuMuc(() => ({
    thuMuc: [{ duongDan: path.join(goc, 'xml'), chi: 'xml' }, { duongDan: path.join(goc, 'excel'), chi: 'excel' }],
    traVe: [], thuMucXuat: path.join(goc, 'ra'), nguon: 'test',
  })))
  const [a, b] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test', version: '1' })
  await Promise.all([server.connect(a), client.connect(b)])
})

afterAll(async () => {
  await client?.close()
  fs.rmSync(goc, { recursive: true, force: true })
})

describe('Máy chủ MCP khaithue', () => {
  it('khai báo đủ công cụ; chỉ xuat_xml_gtgt được ghi', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'chung_tu_nop_tien', 'danh_sach_cong_ty', 'doi_soat', 'doi_tac', 'lap_to_khai_gtgt', 'nap_ho_so', 'so_theo_doi_gtgt', 'tong_quan', 'tra_hoa_don', 'xuat_xml_gtgt',
    ])
    expect(tools.filter((t) => !t.annotations?.readOnlyHint).map((t) => t.name)).toEqual(['xuat_xml_gtgt'])
  })

  it('nạp hồ sơ: nhận đúng công ty, không file nào lỗi', async () => {
    const { kq } = await goi('nap_ho_so')
    expect(kq).toMatchObject({ soXml: 1, soExcel: 1, soSheetHoaDon: 1, loi: [], congTyMacDinh: MST })
  })

  it('lập tờ khai quý 2: [22] = [43] quý 1, đúng công thức và phụ lục, bỏ hoá đơn bị thay thế', async () => {
    const { loi, kq } = await goi('lap_to_khai_gtgt', { quy: 2, nam: 2026 })
    expect(loi).toBe(false)
    const ct = Object.fromEntries(kq.chiTieu.map((c: { ma: string; giaTri: number }) => [c.ma, c.giaTri]))
    expect(ct).toMatchObject({ '[22]': 5000, '[23]': 30000000, '[24]': 3000000, '[32]': 150000000, '[33]': 14000000, '[36]': 11000000, '[40]': 10995000, '[43]': 0 })
    expect(kq.phuLuc.mucII_banRaDuocGiam).toEqual([expect.objectContaining({ mst: '0100000003', giaTri: 50000000, thueGiam: 1000000 })])
    expect(kq.hoaDon).toMatchObject({ banRa: { soHoaDon: 2 }, muaVao: { soHoaDon: 1 }, boQuaDoThayTheHuy: 1 })
    expect(kq.coLoi).toBe(false)
    expect(kq._toKhai).toBeUndefined()
  })

  it('ghi đè [22] sai quy tắc -> báo LỖI và từ chối xuất XML', async () => {
    const { kq } = await goi('xuat_xml_gtgt', { quy: 2, nam: 2026, ct22: 1 })
    expect(kq.daGhi).toBe(false)
    expect(kq.canhBao.join('\n')).toContain('ĐẦU KỲ – CUỐI KỲ KHÔNG KHỚP')
    expect(fs.existsSync(path.join(goc, 'ra'))).toBe(false)
  })

  it('xuất XML rồi đọc lại bằng chính app: số liệu khớp', async () => {
    const { kq } = await goi('xuat_xml_gtgt', { quy: 2, nam: 2026, ngay_lap: '2026-07-20' })
    expect(kq.daGhi).toBe(true)
    expect(path.basename(kq.file)).toBe(`${MST}000-01_GTGT_TT80-Q22026-L00.xml`)
    // Bỏ file vừa xuất vào thư mục nguồn như người dùng nộp xong -> sổ có quý 2, chuỗi đầu kỳ liền mạch
    fs.copyFileSync(kq.file, path.join(goc, 'xml', path.basename(kq.file)))
    await goi('nap_ho_so')
    const so = (await goi('so_theo_doi_gtgt')).kq
    expect(so.gtgt.map((q: { quy: string; khopDauKyVoiQuyTruoc: boolean | null }) => [q.quy, q.khopDauKyVoiQuyTruoc])).toEqual([['2026-Q1', null], ['2026-Q2', true]])
    expect(so.gtgt[1].phienBan[0]).toMatchObject({ ct22: 5000, ct40: 10995000 })
  })

  it('tra hoá đơn, đối tác, tổng quan', async () => {
    const tra = (await goi('tra_hoa_don', { tim: 'khách tám' })).kq
    expect(tra.hoaDon).toEqual([expect.objectContaining({ kyHieu: 'C26TNA', so: '2', chuaThue: 50000000 })])
    expect((await goi('tra_hoa_don', { loai: 'mua', ca_huy: true })).kq.tongSoKhop).toBe(2)
    const dt = (await goi('doi_tac', { nam: 2026 })).kq
    expect(dt.tongBan).toBe(150000000)
    const tq = (await goi('tong_quan', { ngay_hom_nay: '2026-07-25' })).kq
    expect(tq.quy.find((q: { quy: string }) => q.quy === '2026-Q2')).toMatchObject({ phaiNop_ct40: 10995000, daNop: 0 })
  })

  it('MST không có -> trả lỗi rõ ràng, máy chủ không sập', async () => {
    const r = await goi('tong_quan', { mst: '0000000000' })
    expect(r.loi).toBe(true)
    expect(r.kq.loi).toContain('Không có công ty MST 0000000000')
    expect((await goi('danh_sach_cong_ty')).kq).toHaveLength(1)
  })
})
