// Kiểu dữ liệu dùng chung cho toàn app

export type LoaiHD = 'ban' | 'mua'

/** Một dòng trong file Excel "DANH SÁCH HÓA ĐƠN" tải từ hoadondientu.gdt.gov.vn */
export interface HoaDon {
  loai: LoaiHD
  kyHieuMau: string
  kyHieu: string
  so: string
  ngay: string // dd/MM/yyyy
  mstBan: string
  tenBan: string
  dchiBan?: string
  mstMua: string
  tenMua: string
  dchiMua?: string
  chuaThue: number
  thue: number
  trangThai: string
  file: string
}

/** Thông tin người nộp thuế, lấy từ tờ khai cũ hoặc nhập tay */
export interface HoSoDN {
  mst: string
  tenNNT: string
  dchiNNT: string
  phuongXa: string
  maXaNNT: string
  maTinhNNT: string
  tenTinhNNT: string
  dthoaiNNT: string
  emailNNT: string
  maCQTNoiNop: string
  tenCQTNoiNop: string
  nguoiKy: string
}

export interface KyKeKhai {
  quy: 1 | 2 | 3 | 4
  nam: number
}

export interface DongPhuLucMua {
  mst: string
  ten: string
  giaTri: number
  thue: number
}

export interface DongPhuLucBan {
  mst: string
  ten: string
  giaTri: number
  thueSuat: number // 10
  thueSuatSauGiam: number // 8
  thueGiam: number
}

/** Kết quả tờ khai 01/GTGT */
export interface ToKhaiGTGT {
  ct: Record<string, number>
  plMua: DongPhuLucMua[]
  plBan: DongPhuLucBan[]
  tongPlMua: { giaTri: number; thue: number }
  tongPlBan: { giaTri: number; thueGiam: number }
  ct9: number
}

export interface CanhBao {
  muc: 'loi' | 'chu_y'
  noiDung: string
}
