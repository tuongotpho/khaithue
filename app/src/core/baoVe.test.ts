import { describe, expect, it } from 'vitest'
import { kiemDauKy } from './gtgt.js'
import { kiemSoHoaDonBan } from './excel.js'
import type { HoaDon } from './types.js'

describe('Bảo vệ đầu kỳ – cuối kỳ', () => {
  it('khớp thì không cảnh báo', () => expect(kiemDauKy(6_770_539, 6_770_539, '1/2026')).toEqual([]))
  it('lệch thì báo LỖI (chặn xuất file)', () => {
    const cb = kiemDauKy(6_770_539, 0, '1/2026')
    expect(cb).toHaveLength(1)
    expect(cb[0].muc).toBe('loi')
  })
  it('chưa có quý trước thì nhắc, không chặn', () => expect(kiemDauKy(0, null, '2/2026')[0].muc).toBe('chu_y'))
  it('quý trước có bổ sung: không đổi [22], nhắc [37]/[38]', () => {
    const cb = kiemDauKy(6_770_539, 6_770_539, '1/2026', -6_770_539)
    expect(cb).toHaveLength(1)
    expect(cb[0].noiDung).toContain('[37]')
  })
})

describe('Soát số hoá đơn bán ra', () => {
  const hd = (so: string, kyHieu = 'C26TNA') => ({ so, kyHieu }) as HoaDon
  it('liên tục thì không cảnh báo', () => expect(kiemSoHoaDonBan([hd('14'), hd('16'), hd('15')])).toEqual([]))
  it('hụt số thì nhắc', () => expect(kiemSoHoaDonBan([hd('11'), hd('14')])[0].noiDung).toContain('hụt số 12, 13'))
  it('tách riêng từng ký hiệu', () => expect(kiemSoHoaDonBan([hd('1', 'A'), hd('2', 'A'), hd('7', 'B')])).toEqual([]))
})
