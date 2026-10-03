import { describe, expect, it } from 'vitest'
import { phanLoai, type TepHoaDon } from './excel'
import type { HoaDon } from './types'

const CTY = '0100000000'
const hd = (mstBan: string, mstMua: string, so = '1'): HoaDon => ({
  loai: 'ban', kyHieuMau: '1', kyHieu: 'C26T', so, ngay: '10/07/2026', mstBan, tenBan: mstBan === CTY ? 'Cty Mình' : 'Đối tác',
  mstMua, tenMua: mstMua === CTY ? 'Cty Mình' : 'Khách', dchiBan: '', dchiMua: mstMua === CTY ? 'Số 1 phố A' : '', chuaThue: 100, thue: 8, trangThai: 'Hóa đơn mới', file: '',
})
const tep = (ten: string, ds: HoaDon[], goiY: TepHoaDon['goiY'] = null): TepHoaDon => ({ ten, hoaDon: ds.map((h) => ({ ...h, file: ten })), goiY })

describe('Tự nhận diện bán ra / mua vào', () => {
  it('chưa biết công ty: tìm ra MST xuất hiện ở cả 2 chiều', () => {
    const kq = phanLoai([
      tep('ban.xlsx', [hd(CTY, '0300000001', '1'), hd(CTY, '0300000002', '2')]),
      tep('mua.xlsx', [hd('0200000001', CTY, '7'), hd('0200000002', CTY, '8')]),
    ])
    expect(kq.mst).toBe(CTY)
    expect(kq.tenCongTy).toBe('Cty Mình')
    expect(kq.theoTep['ban.xlsx']).toMatchObject({ ban: 2, mua: 0 })
    expect(kq.theoTep['mua.xlsx']).toMatchObject({ ban: 0, mua: 2 })
    expect(kq.canhBao).toEqual([])
  })

  it('một file gộp lẫn bán và mua, CHƯA biết công ty: vẫn tìm ra công ty', () => {
    const kq = phanLoai([tep('gop.xlsx', [hd(CTY, '0300000001', '1'), hd(CTY, '0300000002', '2'), hd('0200000001', CTY, '7'), hd('0200000002', CTY, '8')])])
    expect(kq.mst).toBe(CTY)
    expect(kq.theoTep['gop.xlsx']).toMatchObject({ ban: 2, mua: 2, khac: 0 })
    expect(kq.canhBao).toEqual([])
  })

  it('một file gộp lẫn cả bán lẫn mua: tách từng hoá đơn', () => {
    const kq = phanLoai([tep('gop.xlsx', [hd(CTY, '0300000001', '1'), hd('0200000001', CTY, '7')])], CTY)
    expect(kq.theoTep['gop.xlsx']).toMatchObject({ ban: 1, mua: 1 })
    expect(kq.hoaDon.map((h) => h.loai)).toEqual(['ban', 'mua'])
  })

  it('file kiểu cũ bỏ trống MST của mình: KHÔNG được nhận nhầm khách hàng duy nhất là công ty', () => {
    const kq = phanLoai([
      tep('ban.xlsx', [hd('', '0300000001', '1'), hd('', '0300000001', '2')]),
      tep('mua.xlsx', [hd('0200000001', '', '7'), hd('0200000002', '', '8')]),
    ])
    expect(kq.mst).toBeNull()
    expect(kq.theoTep['ban.xlsx']).toMatchObject({ ban: 2, mua: 0 })
    expect(kq.theoTep['mua.xlsx']).toMatchObject({ ban: 0, mua: 2 })
  })

  it('chỉ có hoá đơn một chiều: vẫn đoán nhưng báo rõ là ĐOÁN', () => {
    const kq = phanLoai([tep('ban.xlsx', [hd(CTY, '0300000001', '1'), hd(CTY, '0300000002', '2')])])
    expect(kq.mst).toBe(CTY)
    expect(kq.canhBao[0].noiDung).toContain('ĐOÁN')
  })

  it('người dùng ép loại cả file khi app nhận sai', () => {
    const kq = phanLoai([tep('x.xlsx', [hd(CTY, '0300000001')])], CTY, { 'x.xlsx': 'mua' })
    expect(kq.theoTep['x.xlsx']).toMatchObject({ ban: 0, mua: 1, epBuoc: true })
  })

  it('tải nhầm hoá đơn của công ty khác: báo lỗi', () => {
    const kq = phanLoai([
      tep('ban.xlsx', [hd('0999999999', '0300000001', '1'), hd('0999999999', '0300000002', '2')]),
    ], CTY)
    expect(kq.canhBao.some((c) => c.muc === 'loi' && c.noiDung.includes('0999999999'))).toBe(true)
    expect(kq.hoaDon).toEqual([])
  })
})
