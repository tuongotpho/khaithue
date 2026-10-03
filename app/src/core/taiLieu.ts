// Đọc MỌI loại file XML thuế tải từ eTax / cổng hoá đơn:
//  - Tờ khai (HSoThueDTu, mọi mẫu: 01/GTGT, 05/KK-TNCN, môn bài, quyết toán, BCTC...)
//  - Chứng từ nộp tiền vào ngân sách (CHUNGTU)
//  - Hoá đơn điện tử (HDon)
// Loại chưa hiểu thì vẫn nhận diện tên gốc để lưu trữ, không bỏ sót.

import { docToKhai, layThe, type ToKhaiDaNop } from './docToKhai'
import type { HoaDon } from './types'

export interface DongChungTu {
  ndkt: string // tiểu mục (1701 = thuế GTGT ...)
  noiDung: string
  kyThue: string // vd 00/Q3/2025
  tien: number
}

export interface ChungTu {
  so: string
  ngay: string // dd/MM/yyyy
  mst: string
  tenNNop: string
  tong: number
  dong: DongChungTu[]
}

export type TaiLieu =
  | { loai: 'toKhai'; tk: ToKhaiDaNop; tenTKhai: string; kieuKy: string; kyChu: string }
  | { loai: 'chungTu'; ct: ChungTu }
  | { loai: 'hoaDon'; hd: Omit<HoaDon, 'loai'> }
  | { loai: 'khac'; goc: string }

const the = (xml: string, tag: string) => layThe(xml, tag)
const so = (s: string) => Number(String(s).replace(/[^\d.-]/g, '')) || 0

/** Kỳ dạng chữ để xếp: 2026-Q2, 2026-M07, 2025 */
export function kyDangChu(kieuKy: string, kyKKhai: string): string {
  let m: RegExpExecArray | null
  if ((m = /^(\d)\/(\d{4})$/.exec(kyKKhai))) return `${m[2]}-Q${m[1]}`
  if ((m = /^(\d{1,2})\/(\d{4})$/.exec(kyKKhai))) return kieuKy === 'Q' ? `${m[2]}-Q${Number(m[1])}` : `${m[2]}-M${m[1].padStart(2, '0')}`
  if ((m = /^(\d{4})$/.exec(kyKKhai))) return m[1]
  if ((m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(kyKKhai))) return `${m[3]}-M${m[2]}` // theo lần phát sinh
  return kyKKhai
}

export function docTaiLieu(xml: string): TaiLieu {
  const goc = /<([A-Za-z_][\w.-]*)[\s>]/.exec(xml.replace(/<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, ''))?.[1] ?? '?'

  if (goc === 'HSoThueDTu') {
    const tk = docToKhai(xml)
    const kieuKy = the(xml, 'kieuKy')
    return { loai: 'toKhai', tk, tenTKhai: the(xml, 'tenTKhai'), kieuKy, kyChu: kyDangChu(kieuKy, the(xml, 'kyKKhai')) }
  }

  if (goc === 'CHUNGTU') {
    const dong = [...xml.matchAll(/<ROW_CTIET>([\s\S]*?)<\/ROW_CTIET>/g)].map((m) => ({
      ndkt: the(m[1], 'MA_NDKT'),
      noiDung: the(m[1], 'NDUNG_NOP'),
      kyThue: the(m[1], 'KY_THUE'),
      tien: so(the(m[1], 'TIEN_PNOP')),
    }))
    return {
      loai: 'chungTu',
      ct: { so: the(xml, 'SO_CTU') || the(xml, 'ID_CTU'), ngay: the(xml, 'NGAY_LAP'), mst: the(xml, 'MST_NNOP'), tenNNop: the(xml, 'TEN_NNOP'), tong: so(the(xml, 'TONG_TIEN')), dong },
    }
  }

  if (goc === 'HDon') {
    const ban = /<NBan>([\s\S]*?)<\/NBan>/.exec(xml)?.[1] ?? ''
    const mua = /<NMua>([\s\S]*?)<\/NMua>/.exec(xml)?.[1] ?? ''
    const tt = /<TToan>([\s\S]*?)<\/TToan>/.exec(xml)?.[1] ?? ''
    const ngay = the(xml, 'NLap').split('-').reverse().join('/')
    return {
      loai: 'hoaDon',
      hd: {
        kyHieuMau: the(xml, 'KHMSHDon'), kyHieu: the(xml, 'KHHDon'), so: the(xml, 'SHDon'), ngay,
        mstBan: the(ban, 'MST'), tenBan: the(ban, 'Ten'), dchiBan: the(ban, 'DChi'),
        mstMua: the(mua, 'MST'), tenMua: the(mua, 'Ten'), dchiMua: the(mua, 'DChi'),
        chuaThue: so(the(tt, 'TgTCThue')), thue: so(the(tt, 'TgTThue')),
        // XML hoá đơn không ghi trạng thái trên cơ quan thuế -> coi là hoá đơn mới; Excel tải sau sẽ cập nhật
        trangThai: 'Hóa đơn mới', file: '',
      },
    }
  }

  return { loai: 'khac', goc }
}

/** Tên loại thuế theo tiểu mục ngân sách (các mã hay gặp ở doanh nghiệp nhỏ) */
const TIEU_MUC: Record<string, string> = {
  '1701': 'Thuế GTGT',
  '1001': 'Thuế TNCN (tiền lương, tiền công)',
  '1052': 'Thuế TNDN',
  '2862': 'Lệ phí môn bài',
  '2863': 'Lệ phí môn bài',
  '2864': 'Lệ phí môn bài',
}
export const tenTieuMuc = (ndkt: string) => TIEU_MUC[ndkt] ?? (ndkt.startsWith('49') ? `Tiền chậm nộp / phạt (${ndkt})` : `Tiểu mục ${ndkt}`)

/** "00/Q3/2025" -> "2025-Q3"; "00/10/2025" -> "2025-M10"; "00/CN/2025" -> "2025" */
export function kyCuaChungTu(kyThue: string): string {
  let m: RegExpExecArray | null
  if ((m = /Q(\d)\/(\d{4})/.exec(kyThue))) return `${m[2]}-Q${m[1]}`
  if ((m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(kyThue))) return `${m[2]}-M${m[1]}`
  if ((m = /(\d{4})/.exec(kyThue))) return m[1]
  return kyThue
}
