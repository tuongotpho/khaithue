// Kiểm file XML app xuất ra:
//  1) đọc lại được đúng số liệu (vòng tròn: tính -> XML -> đọc lại)
//  2) ghi ra thư mục .xml-ra để script Python kiểm theo đặc tả XSD của HTKK (scripts/kiem-xsd.py)

import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { docToKhai } from './docToKhai'
import { tinhGTGT } from './gtgt'
import { tinhTNCN, NHAP_TNCN_TRONG } from './tncn'
import { tenFileXML, xmlGTGT, xmlTNCN } from './xml'
import type { HoaDon, HoSoDN } from './types'

const DN: HoSoDN = {
  mst: '0100000000', tenNNT: 'Công ty TNHH Mẫu & Thử <Test>', dchiNNT: 'Số 1, Phường A', phuongXa: 'Phường A', maXaNNT: '21701002',
  maTinhNNT: '217', tenTinhNNT: 'Tỉnh Phú Thọ', dthoaiNNT: '0900000000', emailNNT: '', maCQTNoiNop: '21701',
  tenCQTNoiNop: 'Thuế cơ sở 1 tỉnh Phú Thọ', nguoiKy: 'Nguyễn Văn A',
}

const hd = (loai: 'ban' | 'mua', so: string, ten: string, v: number, t: number): HoaDon => ({
  loai, kyHieuMau: '1', kyHieu: 'C26TAA', so, ngay: '10/07/2026',
  mstBan: loai === 'ban' ? DN.mst : '0200000000' + so, tenBan: loai === 'ban' ? DN.tenNNT : ten,
  mstMua: loai === 'ban' ? '0300000000' + so : DN.mst, tenMua: loai === 'ban' ? ten : DN.tenNNT,
  chuaThue: v, thue: t, trangThai: 'Hóa đơn mới', file: 'x.xlsx',
})

const KY = { quy: 3 as const, nam: 2026 }
// Luôn ghi file mẫu ra .xml-ra/ (đã bỏ qua trong git) để `npm run kiem-xsd` kiểm theo XSD
const RA = path.resolve('.xml-ra')
fs.mkdirSync(RA, { recursive: true })

describe('Xuất XML', () => {
  it('01/GTGT: đọc lại đúng mọi chỉ tiêu và phụ lục', () => {
    const { toKhai } = tinhGTGT(
      [hd('ban', '1', 'Khách A', 100_000_000, 8_000_000), hd('ban', '2', 'Khách B & Co', 38_605_584, 3_088_447)],
      [hd('mua', '3', 'NCC X', 50_000_000, 4_000_000), hd('mua', '4', 'NCC Y', 10_000_000, 1_000_000)],
    )
    const xml = xmlGTGT(toKhai, KY, DN, '2026-10-20')
    const doc = docToKhai(xml)
    expect(doc.maTKhai).toBe('842')
    expect(doc.ky).toEqual(KY)
    expect(doc.hoSo.tenNNT).toBe(DN.tenNNT)
    for (const [k, v] of Object.entries(toKhai.ct)) expect(doc.ct[k], k).toBe(v)
    expect(doc.plBan).toEqual(toKhai.plBan.map((d) => ({ ten: d.ten, giaTri: d.giaTri, thueGiam: d.thueGiam })))
    expect(doc.plMua).toEqual(toKhai.plMua.map((d) => ({ ten: d.ten, giaTri: d.giaTri, thue: d.thue })))
    expect(doc.ct9).toBe(toKhai.ct9)
    expect(xml).toContain('<kyKKhaiTuNgay>01/07/2026</kyKKhaiTuNgay>')
    expect(xml).toContain('<kyKKhaiDenNgay>30/09/2026</kyKKhaiDenNgay>')
    if (RA) fs.writeFileSync(path.join(RA, tenFileXML('gtgt', KY, DN.mst)), xml)
  })

  it('01/GTGT không phát sinh (không có phụ lục)', () => {
    const { toKhai } = tinhGTGT([], [], { ct21: true, ct22: 6_770_539, ct23a: 0, ct24a: 0, ct26: 0, ct32a: 0, ct37: 0, ct38: 0, ct39a: 0, ct40b: 0, ct42: 0 })
    expect(toKhai.ct.ct43).toBe(6_770_539)
    const xml = xmlGTGT(toKhai, KY, DN, '2026-10-20')
    expect(xml).toContain('<PLuc/>')
    if (RA) fs.writeFileSync(path.join(RA, 'khong-phat-sinh-gtgt.xml'), xml)
  })

  it('05/KK-TNCN: tự cộng các ô tổng, đọc lại đúng', () => {
    const { ct } = tinhTNCN({ ...NHAP_TNCN_TRONG, ct16: 3, ct17: 3, ct22: 15_000_000 })
    expect(ct.ct21).toBe(15_000_000)
    const xml = xmlTNCN(ct, KY, DN, '2026-10-20')
    const doc = docToKhai(xml)
    expect(doc.maTKhai).toBe('864')
    for (const [k, v] of Object.entries(ct)) expect(doc.ct[k], k).toBe(v)
    if (RA) fs.writeFileSync(path.join(RA, tenFileXML('tncn', KY, DN.mst)), xml)
  })
})

import { docDanhSachHoaDon, ngayLap } from './excel'

describe('Đọc Excel: các kiểu ô lạ', () => {
  it('ô ngày kiểu số sê-ri Excel đổi về dd/MM/yyyy', () => {
    expect(ngayLap(46208)).toBe('05/07/2026')
    expect(ngayLap('14/10/2025')).toBe('14/10/2025')
  })
  it('MST bị đổi thành số thì bù số 0 đầu; nhận đúng file mua vào theo MST', () => {
    const rows = [
      ['DANH SÁCH HÓA ĐƠN'],
      ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán/MST người xuất hàng', 'Tên người bán/Tên người xuất hàng', 'Địa chỉ người bán', 'MST người mua/MST người nhận hàng', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Trạng thái hóa đơn'],
      [1, '1', 'C26TXX', 5, 46208, 200000001, 'NCC', 'PT', 100000000, '60.000.000', 4800000, 'Hóa đơn mới'],
    ]
    const kq = docDanhSachHoaDon(rows, 'x.xlsx', '0100000000')
    expect(kq.loai).toBe('mua')
    expect(kq.canhBao).toEqual([])
    expect(kq.hoaDon[0]).toMatchObject({ mstBan: '0200000001', mstMua: '0100000000', ngay: '05/07/2026', chuaThue: 60000000, so: '5' })
  })
})
