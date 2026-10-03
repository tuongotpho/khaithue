import { describe, expect, it } from 'vitest'
import { docTaiLieu, kyCuaChungTu, kyDangChu, tenTieuMuc } from './taiLieu'
import { khoTrong, napHoaDon, napTaiLieu, type Kho } from './kho'
import { tinhTongQuan } from './tongQuan'
import type { HoaDon } from './types'

const MST = '0100000000'
const tk = (ky: string, ct: Record<string, number>, ma = '842', kieuKy = 'Q', ten = 'TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG') =>
  `<?xml version="1.0" encoding="UTF-8"?><HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue"><HSoKhaiThue id="ID_1"><TTinChung><TTinTKhaiThue><TKhaiThue><maTKhai>${ma}</maTKhai><tenTKhai>${ten}</tenTKhai><loaiTKhai>C</loaiTKhai><soLan>0</soLan><KyKKhaiThue><kieuKy>${kieuKy}</kieuKy><kyKKhai>${ky}</kyKKhai></KyKKhaiThue><maCQTNoiNop>1</maCQTNoiNop><tenCQTNoiNop>CQT</tenCQTNoiNop><nguoiKy>A</nguoiKy></TKhaiThue><NNT><mst>${MST}</mst><tenNNT>Cty</tenNNT><dchiNNT>X</dchiNNT><maTinhNNT>1</maTinhNNT><tenTinhNNT>T</tenTinhNNT></NNT></TTinTKhaiThue></TTinChung><CTieuTKhaiChinh>${Object.entries(ct).map(([k, v]) => `<${k}>${v}</${k}>`).join('')}</CTieuTKhaiChinh></HSoKhaiThue></HSoThueDTu>`
const chungTu = (so: string, ky: string, tien: number, ndkt = '1701') =>
  `<?xml version="1.0" encoding="UTF-8"?><CHUNGTU><NDUNG_CTU_NH><SO_CTU>${so}</SO_CTU><NDUNG_CTU><CHUNGTU_HDR><MST_NNOP>${MST}</MST_NNOP><TEN_NNOP>CTY</TEN_NNOP><NGAY_LAP>31/10/2025</NGAY_LAP><TONG_TIEN>${tien}</TONG_TIEN></CHUNGTU_HDR><CHUNGTU_CTIET><ROW_CTIET><NDUNG_NOP>Thuế</NDUNG_NOP><MA_NDKT>${ndkt}</MA_NDKT><KY_THUE>${ky}</KY_THUE><TIEN_PNOP>${tien}</TIEN_PNOP></ROW_CTIET></CHUNGTU_CTIET></NDUNG_CTU></NDUNG_CTU_NH></CHUNGTU>`
const hoaDonXml = `<?xml version="1.0" encoding="UTF-8"?><HDon><DLHDon><TTChung><KHMSHDon>1</KHMSHDon><KHHDon>C25TAA</KHHDon><SHDon>7</SHDon><NLap>2025-08-15</NLap></TTChung><NDHDon><NBan><Ten>Cty</Ten><MST>${MST}</MST><DChi>X</DChi></NBan><NMua><Ten>Khách</Ten><MST>0300000001</MST></NMua><TToan><TgTCThue>100000000</TgTCThue><TgTThue>8000000</TgTThue></TToan></NDHDon></DLHDon></HDon>`

const nap = (kho: Kho, xml: string, ten = 'x.xml') => napTaiLieu(kho, docTaiLieu(xml), ten).kho

describe('Đọc mọi loại tài liệu thuế', () => {
  it('nhận đúng loại: tờ khai / chứng từ / hoá đơn / loại lạ', () => {
    expect(docTaiLieu(tk('3/2025', {})).loai).toBe('toKhai')
    const ct = docTaiLieu(chungTu('123', '00/Q3/2025', 2_860_232))
    expect(ct.loai === 'chungTu' && ct.ct).toMatchObject({ so: '123', tong: 2_860_232, dong: [{ ndkt: '1701', kyThue: '00/Q3/2025', tien: 2_860_232 }] })
    const hd = docTaiLieu(hoaDonXml)
    expect(hd.loai === 'hoaDon' && hd.hd).toMatchObject({ kyHieu: 'C25TAA', so: '7', ngay: '15/08/2025', mstBan: MST, chuaThue: 100_000_000, thue: 8_000_000 })
    expect(docTaiLieu('<?xml version="1.0"?><ThongBao><a/></ThongBao>')).toEqual({ loai: 'khac', goc: 'ThongBao' })
  })
  it('đọc kỳ: quý / tháng / năm', () => {
    expect(kyDangChu('Q', '3/2025')).toBe('2025-Q3')
    expect(kyDangChu('M', '07/2025')).toBe('2025-M07')
    expect(kyDangChu('Y', '2025')).toBe('2025')
    expect(kyCuaChungTu('00/Q3/2025')).toBe('2025-Q3')
    expect(kyCuaChungTu('00/10/2025')).toBe('2025-M10')
    expect(tenTieuMuc('1701')).toBe('Thuế GTGT')
  })
  it('tờ khai loại khác (vd lệ phí môn bài) được lưu trữ, không bị bỏ', () => {
    const kho = nap(khoTrong(), tk('2025', {}, '892', 'Y', 'TỜ KHAI LỆ PHÍ MÔN BÀI'))
    expect(Object.values(kho.toKhaiKhac![MST])).toMatchObject([{ maTKhai: '892', ky: '2025', tenTKhai: 'TỜ KHAI LỆ PHÍ MÔN BÀI' }])
  })
})

describe('Tổng quan doanh nghiệp', () => {
  const HOM_NAY = new Date(2025, 11, 20) // 20/12/2025: quý 4 chưa kết thúc, hạn quý 3 đã qua

  it('phải nộp khớp đã nộp; doanh thu tờ khai khớp hoá đơn; tổng hợp theo năm', () => {
    let kho = nap(khoTrong(), tk('2/2025', { ct22: 0, ct23: 50, ct24: 4, ct34: 100_000_000, ct35: 8_000_000, ct40: 1_000, ct43: 0 }))
    kho = nap(kho, tk('3/2025', { ct22: 0, ct23: 50, ct24: 4, ct34: 100_000_000, ct35: 8_000_000, ct40: 2_860_232, ct43: 0 }))
    kho = nap(kho, chungTu('1', '00/Q2/2025', 1_000))
    kho = nap(kho, chungTu('2', '00/Q3/2025', 2_860_232))
    kho = nap(kho, hoaDonXml) // hoá đơn bán ra 15/08/2025, 100 triệu
    const q = tinhTongQuan(kho, MST, HOM_NAY)
    expect(q.quy.map((x) => x.khoa)).toEqual(['2025-Q3', '2025-Q2'])
    expect(q.quy[0]).toMatchObject({ phaiNop: 2_860_232, daNop: 2_860_232, coChungTu: true, khopDauKy: true })
    expect(q.quy[0].hoaDon?.ban).toEqual({ n: 1, v: 100_000_000, t: 8_000_000 })
    expect(q.nam).toMatchObject([{ nam: 2025, doanhThu: 200_000_000, phaiNop: 2_861_232, daNop: 2_861_232, soQuyCoToKhai: 2 }])
    expect(q.canhBao.filter((c) => c.muc === 'loi')).toEqual([])
  })

  it('cảnh báo: thiếu tờ khai quý đã quá hạn, nộp thiếu, doanh thu lệch hoá đơn, đầu kỳ lệch', () => {
    let kho = nap(khoTrong(), tk('1/2025', { ct22: 0, ct34: 50_000_000, ct40: 0, ct43: 700 }))
    // quý 2 thiếu tờ khai; quý 3 [22] sai (quý trước không có lần đầu -> không kiểm được), quý 3 doanh thu lệch
    kho = nap(kho, tk('3/2025', { ct22: 0, ct34: 1, ct40: 5_000, ct43: 0 }))
    kho = nap(kho, chungTu('9', '00/Q3/2025', 4_000))
    kho = nap(kho, hoaDonXml)
    const cb = tinhTongQuan(kho, MST, HOM_NAY).canhBao.map((c) => `${c.muc}: ${c.noiDung}`)
    expect(cb.some((c) => c.startsWith('loi') && c.includes('Quý 2/2025: chưa thấy tờ khai'))).toBe(true)
    expect(cb.some((c) => c.startsWith('loi') && c.includes('Quý 3/2025') && c.includes('còn thiếu 1.000'))).toBe(true)
    expect(cb.some((c) => c.includes('Quý 3/2025: doanh thu trên tờ khai'))).toBe(true)

    // đầu kỳ: quý 2 có [43]=700, quý 3 khai [22]=0 -> lệch
    kho = nap(kho, tk('2/2025', { ct22: 700, ct40: 0, ct43: 700 }))
    const cb2 = tinhTongQuan(kho, MST, HOM_NAY).canhBao.map((c) => c.noiDung)
    expect(cb2.some((c) => c.includes('Quý 3/2025: [22] không bằng [43]'))).toBe(true)
  })

  it('nhắc hạn nộp quý vừa kết thúc khi chưa có tờ khai', () => {
    const kho = nap(khoTrong(), tk('2/2025', { ct40: 0, ct43: 0 }))
    const q = tinhTongQuan(kho, MST, new Date(2025, 9, 3)) // 03/10/2025
    expect(q.hanToi).toMatchObject({ khoa: '2025-Q3', han: '31/10/2025', conNgay: 28, daCoToKhai: false })
    expect(q.canhBao[0].noiDung).toContain('Hạn nộp tờ khai quý 3/2025: 31/10/2025 (còn 28 ngày)')
  })

  it('hoá đơn trùng giữa Excel (bỏ trống MST của mình) và XML: chỉ tính 1 lần', () => {
    let kho = nap(khoTrong(), tk('3/2025', { ct34: 100_000_000, ct40: 0, ct43: 0 }))
    kho = nap(kho, hoaDonXml) // có MST người bán
    const tuExcel: HoaDon = { loai: 'ban', kyHieuMau: '1', kyHieu: 'C25TAA', so: '7', ngay: '15/08/2025', mstBan: '', tenBan: '', mstMua: '0300000001', tenMua: 'Khách', chuaThue: 100_000_000, thue: 8_000_000, trangThai: 'Hóa đơn mới', file: 'a.xlsx' }
    kho = napHoaDon(kho, MST, [tuExcel])
    const q = tinhTongQuan(kho, MST, HOM_NAY).quy.find((x) => x.khoa === '2025-Q3')!
    expect(q.hoaDon?.ban.n).toBe(1)
  })
})
