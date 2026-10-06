import { describe, expect, it } from 'vitest'
import { docTaiLieu, kyCuaChungTu, kyDangChu, kyDeDoc, tenTieuMuc } from './taiLieu.js'
import { ghiAppXuat, ghiPhuSong, khoTrong, napHoaDon, napTaiLieu, type Kho } from './kho.js'
import { tinhTongQuan } from './tongQuan.js'
import type { HoaDon } from './types.js'
import { gopHoaDon } from './excel.js'
import { tinhGTGT } from './gtgt.js'

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

  it('bản app xuất KHÔNG được coi là đã nộp', () => {
    let kho = nap(khoTrong(), tk('2/2025', { ct40: 0, ct43: 0 }))
    kho = ghiAppXuat(kho, MST, { quy: 3, nam: 2025 }, { ct22: 0, ct36: 0, ct40: 0, ct41: 0, ct43: 0, ct34: 0, ct35: 0, ct23: 0, ct24: 0 })
    const q = tinhTongQuan(kho, MST, new Date(2025, 9, 3))
    expect(q.hanToi).toMatchObject({ khoa: '2025-Q3', daCoToKhai: false, daXuat: true })
    expect(q.canhBao.some((c) => c.noiDung.includes('Quý 3/2025: mới có bản APP XUẤT'))).toBe(true)
  })

  it('mọi khoản nộp ngân sách cộng theo năm nộp, chia loại; tên khoản & kỳ dễ đọc', () => {
    const ngay = (xml: string, d: string) => xml.replace('31/10/2025', d)
    let kho = nap(khoTrong(), ngay(chungTu('1', '00/Q4/2024', 1_000_000), '03/02/2025'))
    kho = nap(kho, ngay(chungTu('2', '00/CN/2024', 500_000, '1052'), '31/03/2025'))
    kho = nap(kho, ngay(chungTu('3', '00/CN/2024', 1_000, '4918'), '05/05/2025'))
    kho = nap(kho, ngay(chungTu('4', '00/CN/2025', 2_000_000, '2863'), '25/01/2025'))
    kho = nap(kho, ngay(chungTu('5', '14/07/2026', 2_000, '4944'), '31/07/2026'))
    const q = tinhTongQuan(kho, MST, HOM_NAY)
    expect(q.nopTheoNam).toEqual([
      { nam: 2026, theoNhom: { 'Chậm nộp, phạt': 2_000 }, tong: 2_000, soCT: 1 },
      { nam: 2025, theoNhom: { GTGT: 1_000_000, TNDN: 500_000, 'Chậm nộp, phạt': 1_000, 'Môn bài': 2_000_000 }, tong: 3_501_000, soCT: 4 },
    ])
    expect(tenTieuMuc('4918')).toBe('Tiền chậm nộp thuế TNDN')
    expect(kyDeDoc('00/Q3/2026')).toBe('quý 3/2026')
    expect(kyDeDoc('00/CN/2024')).toBe('năm 2024')
    expect(kyDeDoc('14/07/2026')).toBe('theo thông báo ngày 14/07/2026')
  })

  describe('Mua vào trên tờ khai lệch hoá đơn', () => {
    const mua = (so: string, ngay: string, v: number, trangThai = 'Hóa đơn mới', file = 'mua.xlsx'): HoaDon => ({
      loai: 'mua', kyHieuMau: '1', kyHieu: 'C26TXX', so, ngay, mstBan: '0200000009', tenBan: 'NCC', mstMua: MST, tenMua: 'Cty',
      chuaThue: v, thue: v * 0.08, trangThai, file,
    })
    // Cặp "bị thay thế / thay thế" giống vụ thật: HĐ 18 bị HĐ 19 thay thế, tờ khai lại khai cả hai
    const kho0 = () => {
      let kho = nap(khoTrong(), tk('1/2026', { ct22: 0, ct23: 190_000_000, ct34: 0, ct40: 0, ct43: 0 }))
      kho = napHoaDon(kho, MST, [
        mua('17', '10/01/2026', 5_000_000),
        mua('18', '26/02/2026', 90_000_000, 'Hóa đơn đã bị thay thế'),
        mua('19', '27/02/2026', 95_000_000, 'Hóa đơn thay thế'),
      ])
      return kho
    }
    const HN = new Date(2026, 9, 7)

    it('tờ khai khấu trừ cả hoá đơn đã bị thay thế -> LỖI, chỉ đích danh hoá đơn', () => {
      const kho = ghiPhuSong(kho0(), MST, { ban: [], mua: ['2026-01', '2026-02', '2026-03'] })
      const cb = tinhTongQuan(kho, MST, HN).canhBao.filter((c) => c.noiDung.includes('mua vào'))
      expect(cb).toHaveLength(1)
      expect(cb[0].muc).toBe('loi')
      expect(cb[0].noiDung).toContain('lệch 90.000.000 đ')
      expect(cb[0].noiDung).toContain('C26TXX-18')
    })

    it('danh sách hoá đơn mua vào chưa đủ 3 tháng -> không báo (tránh báo nhầm do thiếu file)', () => {
      const kho = ghiPhuSong(kho0(), MST, { ban: [], mua: ['2026-01', '2026-02'] })
      expect(tinhTongQuan(kho, MST, HN).canhBao.some((c) => c.noiDung.includes('mua vào'))).toBe(false)
    })

    it('hoá đơn mua vào nhiều hơn tờ khai -> nhắc còn hoá đơn chưa kê khai', () => {
      let kho = nap(khoTrong(), tk('1/2026', { ct22: 0, ct23: 5_000_000, ct34: 0, ct40: 0, ct43: 0 }))
      kho = napHoaDon(kho, MST, [mua('17', '10/01/2026', 5_000_000), mua('20', '15/03/2026', 2_000_000)])
      kho = ghiPhuSong(kho, MST, { ban: [], mua: ['2026-01', '2026-02', '2026-03'] })
      const cb = tinhTongQuan(kho, MST, HN).canhBao.find((c) => c.noiDung.includes('mua vào'))
      expect(cb).toMatchObject({ muc: 'chu_y' })
      expect(cb!.noiDung).toContain('còn 2.000.000 đ hoá đơn mua vào chưa kê khai')
    })

    it('LẬP TỜ KHAI: chỉ khấu trừ hoá đơn thay thế, bỏ hoá đơn bị thay thế; trạng thái mới nhất thắng khi trùng giữa 2 file', () => {
      const ky = { quy: 1, nam: 2026 } as const
      const ds = [
        mua('17', '10/01/2026', 5_000_000),
        mua('18', '26/02/2026', 90_000_000, 'Hóa đơn mới', 'tai-lan-1.xlsx'), // lần tải đầu: còn "mới"
        mua('18', '26/02/2026', 90_000_000, 'Hóa đơn đã bị thay thế', 'tai-lan-2.xlsx'), // tải lại: đã bị thay thế
        mua('19', '27/02/2026', 95_000_000, 'Hóa đơn thay thế'),
        mua('21', '20/03/2026', 1_000_000, 'Hóa đơn đã bị xóa bỏ'),
      ]
      const g = gopHoaDon(ds, ky)
      expect(g.mua.map((h) => h.so).sort()).toEqual(['17', '19'])
      expect(g.boQua.map((h) => h.so).sort()).toEqual(['18', '21'])
      const ct = tinhGTGT([], g.mua).toKhai.ct
      expect([ct.ct23, ct.ct24]).toEqual([100_000_000, 8_000_000])
    })
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

import { tinhDoiTac } from './tongQuan.js'

describe('Đối tác', () => {
  const h = (loai: 'ban' | 'mua', so: string, ngay: string, ten: string, mstDT: string, v: number, trangThai = 'Hóa đơn mới'): HoaDon => ({
    loai, kyHieuMau: '1', kyHieu: loai === 'ban' ? 'C25TAA' : 'C25TXX', so, ngay,
    mstBan: loai === 'ban' ? MST : mstDT, tenBan: loai === 'ban' ? 'Cty' : ten,
    mstMua: loai === 'ban' ? mstDT : MST, tenMua: loai === 'ban' ? ten : 'Cty',
    chuaThue: v, thue: v * 0.08, trangThai, file: '',
  })
  const kho = napHoaDon(khoTrong(), MST, [
    h('ban', '1', '10/01/2025', 'CÔNG TY A', '0300000001', 600),
    h('ban', '2', '10/05/2025', 'Công ty A', '', 200), // thiếu MST, khác hoa/thường -> vẫn gom vào A
    h('ban', '3', '10/08/2025', 'Công ty B', '0300000002', 200),
    h('ban', '4', '10/09/2025', 'Công ty B', '0300000002', 999, 'Hóa đơn đã bị thay thế'), // không tính
    h('ban', '5', '10/02/2024', 'Công ty B', '0300000002', 100), // năm khác
    h('mua', '7', '05/03/2025', 'NCC X', '0200000001', 500),
  ])

  it('gom theo đối tác, bỏ hoá đơn bị thay thế, tỷ trọng, số quý, ngày gần nhất', () => {
    const d = tinhDoiTac(kho, MST, 2025)
    expect(d.tongBan).toBe(1000)
    expect(d.ban.map((x) => [x.mst, x.n, x.v, x.tyTrong, x.soQuy, x.cuoi, x.tuToKhai])).toEqual([
      ['0300000001', 2, 800, 0.8, 2, '10/05/2025', false],
      ['0300000002', 1, 200, 0.2, 1, '10/08/2025', false],
    ])
    expect(d.mua).toMatchObject([{ mst: '0200000001', n: 1, v: 500, tyTrong: 1 }])
  })

  it('tất cả các năm', () => {
    const d = tinhDoiTac(kho, MST, null)
    expect(d.ban.find((x) => x.mst === '0300000002')).toMatchObject({ n: 2, v: 300, soQuy: 2 })
  })
})

describe('Đối tác lấy từ phụ lục tờ khai khi quý chưa có hoá đơn', () => {
  const tkPL = (ky: string, ban: [string, number][], mua: [string, number, number][]) =>
    tk(ky, { ct22: 0, ct40: 0, ct43: 0 }).replace(
      '</CTieuTKhaiChinh>',
      `</CTieuTKhaiChinh><PLuc><PL_NQ142_GTGT><HH_DV_MuaVaoTrongKy>${mua.map(([t, v, th]) => `<BangKeTenHHDV><tenHHDVMuaVao>${t}</tenHHDVMuaVao><giaTriHHDVMuaVao>${v}</giaTriHHDVMuaVao><thueGTGTHHDV>${th}</thueGTGTHHDV></BangKeTenHHDV>`).join('')}</HH_DV_MuaVaoTrongKy><HH_DV_BanRaTrongKy>${ban.map(([t, v]) => `<BangKeTenHHDV><tenHHDV>${t}</tenHHDV><giaTriHHDV>${v}</giaTriHHDV><thueSuatTheoQuyDinh>10</thueSuatTheoQuyDinh><thueSuatSauGiam>8</thueSuatSauGiam><thueGTGTDuocGiam>${v * 0.02}</thueGTGTDuocGiam></BangKeTenHHDV>`).join('')}</HH_DV_BanRaTrongKy></PL_NQ142_GTGT></PLuc>`,
    )

  const tuExcel = (so: string, ngay: string, ten: string, mstKhach: string, v: number): HoaDon => ({
    loai: 'ban', kyHieuMau: '1', kyHieu: 'C25TAA', so, ngay, mstBan: MST, tenBan: 'Cty', mstMua: mstKhach, tenMua: ten,
    chuaThue: v, thue: v * 0.08, trangThai: 'Hóa đơn mới', file: 'ds.xlsx',
  })

  it('TÌM ĐƯỢC FILE CÁC NĂM TRƯỚC: thiếu tháng thì giữ phụ lục; đủ tháng thì chuyển sang hoá đơn; KHÔNG cộng trùng', () => {
    // Tờ khai quý 4/2025: bán cho Khách 300 triệu (phụ lục)
    let kho = nap(khoTrong(), tkPL('4/2025', [['Khách', 300_000_000]], []))
    const thang = (so: string, ngay: string, thangPhu: string) => {
      kho = napHoaDon(kho, MST, [tuExcel(so, ngay, 'Khách', '0300000001', 100_000_000)])
      kho = ghiPhuSong(kho, MST, { ban: [thangPhu], mua: [] })
    }
    // 1) Mới tìm được file tháng 10
    thang('1', '10/10/2025', '2025-10')
    let d = tinhDoiTac(kho, MST, 2025)
    expect(d.nguonQuy).toEqual([{ khoa: '2025-Q4', ban: 'toKhaiThieuHD', mua: 'thieu', thangThieu: { ban: ['2025-11', '2025-12'], mua: [] } }])
    expect(d.tongBan).toBe(300_000_000) // vẫn theo phụ lục, KHÔNG cộng thêm 100 triệu của tháng 10
    // 2) Tìm thêm tháng 11, 12
    thang('2', '10/11/2025', '2025-11')
    thang('3', '10/12/2025', '2025-12')
    d = tinhDoiTac(kho, MST, 2025)
    expect(d.nguonQuy).toMatchObject([{ ban: 'hoaDon' }])
    expect(d.tongBan).toBe(300_000_000) // theo hoá đơn, KHÔNG cộng thêm phụ lục
    expect(d.ban).toMatchObject([{ mst: '0300000001', n: 3, tuToKhai: false }])
    // 3) Nạp lại file tháng 10 lần nữa: không đổi
    thang('1', '10/10/2025', '2025-10')
    expect(tinhDoiTac(kho, MST, 2025).tongBan).toBe(300_000_000)
  })

  it('quý chưa có hoá đơn: lấy từ phụ lục; quý có danh sách hoá đơn trọn kỳ: chỉ dùng hoá đơn (không cộng trùng)', () => {
    let kho = nap(khoTrong(), tkPL('1/2025', [['CÔNG TY A', 1000]], [['NCC X', 500, 40]]))
    kho = nap(kho, tkPL('3/2025', [['CÔNG TY A', 999_999]], [])) // quý 3 có Excel trọn kỳ -> bỏ phụ lục này
    kho = napHoaDon(kho, MST, [tuExcel('7', '15/08/2025', 'Khách', '0300000001', 100_000_000)])
    kho = ghiPhuSong(kho, MST, { ban: ['2025-07', '2025-08', '2025-09'], mua: [] })
    const d = tinhDoiTac(kho, MST, 2025)
    expect(d.nguonQuy).toEqual([
      { khoa: '2025-Q1', ban: 'toKhai', mua: 'toKhai' },
      { khoa: '2025-Q3', ban: 'hoaDon', mua: 'thieu' },
    ])
    expect(d.tongBan).toBe(1000 + 100_000_000)
    expect(d.ban.find((x) => x.ten === 'CÔNG TY A')).toMatchObject({ v: 1000, t: 80, n: 0, tuToKhai: true, cuoi: 'quý 1/2025', soQuy: 1 })
    expect(d.mua).toMatchObject([{ ten: 'NCC X', v: 500, t: 40, tuToKhai: true }])
  })

  it('chỉ có vài hoá đơn XML lẻ: chưa đủ -> dùng phụ lục tờ khai', () => {
    let kho = nap(khoTrong(), tkPL('3/2025', [['Khách', 100_000_000], ['CÔNG TY A', 50_000_000]], []))
    kho = nap(kho, hoaDonXml) // 1 hoá đơn XML lẻ quý 3
    const d = tinhDoiTac(kho, MST, 2025)
    expect(d.nguonQuy).toMatchObject([{ khoa: '2025-Q3', ban: 'toKhaiThieuHD', mua: 'thieu' }])
    expect(d.tongBan).toBe(150_000_000)
  })

  it('danh sách trọn kỳ được tin hơn tờ khai, kể cả khi tờ khai khai thừa', () => {
    let kho = nap(khoTrong(), tkPL('3/2025', [['Khách', 190_000_000]], [])) // tờ khai khai thừa
    kho = napHoaDon(kho, MST, [tuExcel('7', '15/08/2025', 'Khách', '0300000001', 100_000_000)])
    kho = ghiPhuSong(kho, MST, { ban: ['2025-07', '2025-08', '2025-09'], mua: [] }) // danh sách đủ 3 tháng
    expect(tinhDoiTac(kho, MST, 2025)).toMatchObject({ tongBan: 100_000_000, nguonQuy: [{ ban: 'hoaDon' }] })
  })

  it('tên trong phụ lục gộp vào đúng khách đã biết MST từ hoá đơn', () => {
    let kho = nap(khoTrong(), tkPL('1/2025', [['Khách', 1000]], []))
    kho = napHoaDon(kho, MST, [tuExcel('7', '15/08/2025', 'Khách', '0300000001', 100_000_000)]) // "Khách" có MST (quý 3)
    const d = tinhDoiTac(kho, MST, 2025)
    expect(d.ban).toHaveLength(1)
    expect(d.ban[0]).toMatchObject({ mst: '0300000001', n: 1, v: 100_001_000, soQuy: 2, tuToKhai: true, cuoi: '15/08/2025' })
  })
})

import { chuanTen } from './tongQuan.js'

describe('So tên doanh nghiệp viết tắt', () => {
  it('CP / Cổ phần, CTY / Công ty, MTV, TM, DV... là một', () => {
    expect(chuanTen('Công ty CP Năng lượng xanh Thăng Long')).toBe(chuanTen('CÔNG TY CỔ PHẦN NĂNG LƯỢNG XANH THĂNG LONG'))
    expect(chuanTen('Cty TNHH MTV  TM-DV Hà An')).toBe(chuanTen('CÔNG TY TNHH MỘT THÀNH VIÊN THƯƠNG MẠI DỊCH VỤ HÀ AN'))
    expect(chuanTen('Công ty TNHH Năng lượng VNG')).not.toBe(chuanTen('Công ty TNHH Năng lượng VNC'))
  })
})

import { cacThang, docTep, phanLoai as phanLoaiTep, phuSongCuaTep } from './excel.js'

describe('Tháng phủ của file Excel', () => {
  it('đọc kỳ trên đầu file và các tháng có hoá đơn', () => {
    expect(cacThang('01/11/2025', '31/01/2026')).toEqual(['2025-11', '2025-12', '2026-01'])
    const rows = [
      ['DANH SÁCH HÓA ĐƠN'],
      ['Từ ngày 01/01/2026 đến ngày 31/01/2026'], // file tự gộp: tiêu đề tháng 1 nhưng có hoá đơn tháng 3
      ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán/MST người xuất hàng', 'Tên người bán/Tên người xuất hàng', 'MST người mua/MST người nhận hàng', 'Tên người mua/Tên người nhận hàng', 'Địa chỉ người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Trạng thái hóa đơn'],
      [1, '1', 'C26TAA', '1', '05/01/2026', MST, 'Cty', '0300000001', 'Khách', 'HN', 100, 8, 'Hóa đơn mới'],
      [2, '1', 'C26TAA', '2', '05/03/2026', MST, 'Cty', '0300000001', 'Khách', 'HN', 100, 8, 'Hóa đơn mới'],
    ]
    const t = docTep(rows, 'gop.xlsx')!
    expect([t.tu, t.den]).toEqual(['01/01/2026', '31/01/2026'])
    expect(phuSongCuaTep(t, phanLoaiTep([t], MST).hoaDon)).toEqual({ ban: ['2026-01', '2026-03'], mua: [] })
  })
})
