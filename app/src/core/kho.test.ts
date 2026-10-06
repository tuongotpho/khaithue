import { describe, expect, it } from 'vitest'
import { dauKy, datKhongChapNhan, ghiAppXuat, khoTrong, napToKhai, soCai, suaHoSo, tncnGanNhat } from './kho.js'
import type { ToKhaiDaNop } from './docToKhai.js'
import type { HoSoDN } from './types.js'

const HS: HoSoDN = {
  mst: '0100000000', tenNNT: 'Cty A', dchiNNT: 'Đ/c cũ', phuongXa: '', maXaNNT: '', maTinhNNT: '217', tenTinhNNT: 'Phú Thọ',
  dthoaiNNT: '', emailNNT: '', maCQTNoiNop: '21701', tenCQTNoiNop: 'CQT', nguoiKy: 'Người A',
}
const tk = (quy: 1 | 2 | 3 | 4, nam: number, ct: Record<string, number>, them: Partial<ToKhaiDaNop> = {}): ToKhaiDaNop => ({
  maTKhai: '842', loaiTKhai: 'C', soLan: 0, ngayLap: '', ky: { quy, nam }, hoSo: HS, ct, plMua: [], plBan: [], ct9: null, ...them,
})

describe('Sổ theo dõi tờ khai', () => {
  it('[22] lấy từ [43] bản LẦN ĐẦU quý trước, không phải bản bổ sung', () => {
    let kho = napToKhai(khoTrong(), tk(1, 2026, { ct22: 0, ct43: 6_770_539 }), 'q1.xml').kho
    kho = napToKhai(kho, tk(1, 2026, { ct22: 0, ct43: 0, ct40: 401_941 }, { loaiTKhai: 'B', soLan: 1 }), 'q1-bs.xml').kho
    const d = dauKy(kho, HS.mst, { quy: 2, nam: 2026 })
    expect(d.ct22).toBe(6_770_539)
    expect(d.chenhBoSung).toBe(-6_770_539) // bổ sung làm giảm số được khấu trừ -> nhắc khai [37]
  })

  it('bản bị cơ quan thuế không chấp nhận thì bỏ qua', () => {
    let kho = napToKhai(khoTrong(), tk(1, 2026, { ct43: 6_770_539 }), 'a.xml').kho
    kho = napToKhai(kho, tk(1, 2026, { ct43: 0 }), 'b.xml').kho
    expect(dauKy(kho, HS.mst, { quy: 2, nam: 2026 })).toMatchObject({ ct22: null, xungDot: true })
    kho = datKhongChapNhan(kho, HS.mst, '2026-Q1', 0, true)
    expect(dauKy(kho, HS.mst, { quy: 2, nam: 2026 })).toMatchObject({ ct22: 0, xungDot: false })
  })

  it('nạp lại cùng một tờ khai (bản ký và bản chưa ký) không bị nhân đôi', () => {
    let kho = napToKhai(khoTrong(), tk(4, 2025, { ct43: 0, ct40: 7_957_468 }), 'chua-ky.xml').kho
    kho = napToKhai(kho, tk(4, 2025, { ct43: 0, ct40: 7_957_468 }), 'da-ky.xml').kho
    expect(kho.gtgt[HS.mst]['2025-Q4']).toHaveLength(1)
  })

  it('quý 1 lấy [43] của quý 4 năm trước', () => {
    const kho = napToKhai(khoTrong(), tk(4, 2025, { ct43: 123 }), 'x.xml').kho
    expect(dauKy(kho, HS.mst, { quy: 1, nam: 2026 }).ct22).toBe(123)
  })

  it('sổ cái phát hiện đứt chuỗi đầu kỳ – cuối kỳ', () => {
    let kho = napToKhai(khoTrong(), tk(1, 2026, { ct22: 0, ct43: 500 }), 'q1.xml').kho
    kho = napToKhai(kho, tk(2, 2026, { ct22: 999, ct43: 0 }), 'q2.xml').kho
    kho = napToKhai(kho, tk(3, 2026, { ct22: 0, ct43: 0 }), 'q3.xml').kho
    expect(soCai(kho, HS.mst).map((d) => d.khop)).toEqual([null, false, true])
  })

  it('bản app xuất bị thay bằng file thật khi nạp', () => {
    let kho = ghiAppXuat(khoTrong(), HS.mst, { quy: 3, nam: 2026 }, { ct22: 0, ct36: 1, ct40: 1, ct41: 0, ct43: 0 })
    expect(kho.gtgt[HS.mst]['2026-Q3'][0].nguon).toBe('app')
    kho = napToKhai(kho, tk(3, 2026, { ct43: 0, ct40: 1 }), 'that.xml').kho
    expect(kho.gtgt[HS.mst]['2026-Q3'].map((x) => x.nguon)).toEqual(['xml'])
  })

  it('thông tin công ty: tờ khai mới ghi đè; đã sửa tay thì XML không ghi đè', () => {
    let kho = napToKhai(khoTrong(), tk(1, 2025, {}), 'cu.xml').kho
    kho = napToKhai(kho, tk(2, 2026, {}, { hoSo: { ...HS, dchiNNT: 'Đ/c mới' } }), 'moi.xml').kho
    expect(kho.congTy[HS.mst].hoSo.dchiNNT).toBe('Đ/c mới')
    // nạp bản cũ hơn sau: không ghi đè
    kho = napToKhai(kho, tk(1, 2025, {}, { hoSo: { ...HS, dchiNNT: 'Đ/c cũ' } }), 'cu.xml').kho
    expect(kho.congTy[HS.mst].hoSo.dchiNNT).toBe('Đ/c mới')
    // người dùng sửa tay người ký -> XML mới hơn cũng không ghi đè
    kho = suaHoSo(kho, { ...kho.congTy[HS.mst].hoSo, nguoiKy: 'Người B' })
    kho = napToKhai(kho, tk(3, 2026, {}), 'q3.xml').kho
    expect(kho.congTy[HS.mst].hoSo.nguoiKy).toBe('Người B')
  })

  it('nhiều công ty: công ty thứ hai không làm mất công ty đầu', () => {
    let kho = napToKhai(khoTrong(), tk(1, 2026, {}), 'a.xml').kho
    kho = napToKhai(kho, tk(1, 2026, {}, { hoSo: { ...HS, mst: '0200000000', tenNNT: 'Cty B' } }), 'b.xml').kho
    expect(Object.keys(kho.congTy).sort()).toEqual(['0100000000', '0200000000'])
    expect(kho.chon).toBe('0100000000')
  })

  it('TNCN: lấy số quý gần nhất trước quý đang khai', () => {
    let kho = napToKhai(khoTrong(), { ...tk(4, 2025, { ct16: 3 }), maTKhai: '864' }, 't4.xml').kho
    kho = napToKhai(kho, { ...tk(1, 2026, { ct16: 4 }), maTKhai: '864' }, 't1.xml').kho
    expect(tncnGanNhat(kho, HS.mst, { quy: 2, nam: 2026 })?.ct16).toBe(4)
    expect(tncnGanNhat(kho, HS.mst, { quy: 1, nam: 2026 })?.ct16).toBe(3)
  })
})

import { gopTuMay } from './kho.js'

describe('Gộp dữ liệu từ mây', () => {
  it('dựng lại sổ từ các bản ghi trên mây, giữ cờ "CQT trả về", nhớ mã bản ghi', () => {
    const congTy = [{ hoSo: { ...HS, nguoiKy: 'Người sửa tay' }, kyNguon: '2026-Q1', suaTay: true }]
    const kho = gopTuMay(khoTrong(), congTy, [
      { id: 'a', mst: HS.mst, maTKhai: '842', ky: '2026-Q1', loaiTKhai: 'C', soLan: 0, ngayLap: '', ct: { ct43: 500 }, tenFile: 'a.xml', khongChapNhan: true },
      { id: 'b', mst: HS.mst, maTKhai: '842', ky: '2026-Q1', loaiTKhai: 'C', soLan: 0, ngayLap: '', ct: { ct43: 0 }, tenFile: 'b.xml' },
      { id: 'c', mst: HS.mst, maTKhai: '842', ky: '2026-Q1', loaiTKhai: 'C', soLan: 0, ngayLap: '', ct: { ct43: 0 }, tenFile: 'b-da-ky.xml' },
    ])
    expect(kho.congTy[HS.mst].hoSo.nguoiKy).toBe('Người sửa tay')
    expect(dauKy(kho, HS.mst, { quy: 2, nam: 2026 }).ct22).toBe(0)
    const ds = kho.gtgt[HS.mst]['2026-Q1']
    expect(ds).toHaveLength(2)
    expect(ds.find((x) => x.ct43 === 500)?.khongChapNhan).toBe(true)
    expect(ds.find((x) => x.ct43 === 0)?.ids?.sort()).toEqual(['b', 'c'])
  })
})
