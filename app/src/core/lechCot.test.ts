import { describe, expect, it } from 'vitest'
import { docTep, phanLoai } from './excel.js'

const CTY = '0100000000'
const TD = ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán/MST người xuất hàng', 'Tên người bán/Tên người xuất hàng', 'Địa chỉ người bán', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Tổng tiền chiết khấu thương mại', 'Tổng tiền phí', 'Tổng tiền thanh toán', 'Đơn vị tiền tệ', 'Tỷ giá', 'Trạng thái hóa đơn']

describe('File Excel ghép tay bị lệch cột', () => {
  it('dòng có thêm cột "MST người mua" chèn trước cột tiền: tự đọc lại đúng, không ra số tỷ', () => {
    const rows = [
      ['DANH SÁCH HÓA ĐƠN'], ['Từ ngày 01/01/2025 đến ngày 31/03/2025'], TD,
      // dòng đúng khuôn tiêu đề
      [1, '1', 'C25TMV', '1', '01/01/2025', '0200000001', 'NCC A', 'PT', 4208750, 336700, null, null, 4545450, 'VND', '1.0', 'Hóa đơn mới'],
      // dòng dán từ bản tải khác: có thêm MST người mua (là MST công ty) chèn trước cột tiền
      [2, '1', 'C25TLX', '329', '26/12/2025', '0200000002', 'NCC B', 'HN', CTY, 94482000, 7558560, 0, 102040560, 'VND', '1.0', 'Hóa đơn đã bị thay thế'],
    ]
    const t = docTep(rows, 'gop.xlsx')!
    expect(t.suaLechCot).toBe(1)
    expect(t.hoaDon.map((h) => [h.chuaThue, h.thue, h.mstMua, h.trangThai])).toEqual([
      [4208750, 336700, '', 'Hóa đơn mới'],
      [94482000, 7558560, CTY, 'Hóa đơn đã bị thay thế'],
    ])
    const kq = phanLoai([t], CTY)
    expect(kq.canhBao.some((c) => c.noiDung.includes('1 dòng bị lệch cột'))).toBe(true)
  })

  it('dòng số tiền vô lý không sửa được: bỏ ra và báo, không lọt vào số liệu', () => {
    const rows = [TD, [1, '1', 'C25TAA', '7', '01/02/2025', '0200000001', 'NCC A', 'PT', 1000, 900, null, null, 1900, 'VND', '1.0', 'Hóa đơn mới']]
    const t = docTep(rows, 'hong.xlsx')!
    expect(t.hoaDon).toEqual([])
    expect(t.boDong).toBe(1)
  })
})
