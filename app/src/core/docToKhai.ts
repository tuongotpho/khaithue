// Đọc lại file XML tờ khai đã nộp (HTKK hoặc eTax) để:
//  - lấy thông tin doanh nghiệp (khỏi gõ lại)
//  - lấy [43] quý trước làm [22] quý này
//  - đối chiếu số liệu trong test

import type { HoSoDN, KyKeKhai } from './types.js'

/** Lấy text của thẻ đầu tiên tên `tag` (bỏ qua tiền tố namespace) */
export function layThe(xml: string, tag: string): string {
  const m = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${tag}>`).exec(xml)
  return m ? giaiMa(m[1].trim()) : ''
}

function giaiMa(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

const so = (s: string) => (s === '' ? 0 : s === 'true' ? 1 : s === 'false' ? 0 : Number(s))

export interface ToKhaiDaNop {
  maTKhai: string
  /** C = chính thức (lần đầu), B = bổ sung */
  loaiTKhai: string
  soLan: number
  ngayLap: string
  ky: KyKeKhai | null
  hoSo: HoSoDN
  ct: Record<string, number>
  plMua: { ten: string; giaTri: number; thue: number }[]
  plBan: { ten: string; giaTri: number; thueGiam: number }[]
  ct9: number | null
}

export function docToKhai(xml: string): ToKhaiDaNop {
  const ky = /^(\d)\/(\d{4})$/.exec(layThe(xml, 'kyKKhai'))
  const chinh = /<CTieuTKhaiChinh>([\s\S]*?)<\/CTieuTKhaiChinh>/.exec(xml)?.[1] ?? ''
  const ct: Record<string, number> = {}
  for (const m of chinh.matchAll(/<(ct\w+)>([^<]*)<\/\1>/g)) ct[m[1]] = so(m[2].trim())

  const plMua = [...xml.matchAll(/<BangKeTenHHDV[^>]*>\s*<tenHHDVMuaVao>([^<]*)<\/tenHHDVMuaVao>\s*<giaTriHHDVMuaVao>([^<]*)<\/giaTriHHDVMuaVao>\s*<thueGTGTHHDV>([^<]*)<\/thueGTGTHHDV>/g)]
    .map((m) => ({ ten: giaiMa(m[1]), giaTri: so(m[2]), thue: so(m[3]) }))
  const plBan = [...xml.matchAll(/<tenHHDV>([^<]*)<\/tenHHDV>\s*<giaTriHHDV>([^<]*)<\/giaTriHHDV>[\s\S]*?<thueGTGTDuocGiam>([^<]*)<\/thueGTGTDuocGiam>/g)]
    .map((m) => ({ ten: giaiMa(m[1]), giaTri: so(m[2]), thueGiam: so(m[3]) }))
  const ct9 = layThe(xml, 'ct9')

  return {
    maTKhai: layThe(xml, 'maTKhai'),
    loaiTKhai: layThe(xml, 'loaiTKhai') || 'C',
    soLan: Number(layThe(xml, 'soLan')) || 0,
    ngayLap: layThe(xml, 'ngayLapTKhai'),
    ky: ky ? { quy: Number(ky[1]) as 1 | 2 | 3 | 4, nam: Number(ky[2]) } : null,
    hoSo: {
      mst: layThe(xml, 'mst'),
      tenNNT: layThe(xml, 'tenNNT'),
      dchiNNT: layThe(xml, 'dchiNNT'),
      phuongXa: layThe(xml, 'phuongXa') || layThe(xml, 'tenXaNNT'),
      maXaNNT: layThe(xml, 'maXaNNT'),
      maTinhNNT: layThe(xml, 'maTinhNNT'),
      tenTinhNNT: layThe(xml, 'tenTinhNNT'),
      dthoaiNNT: layThe(xml, 'dthoaiNNT'),
      emailNNT: layThe(xml, 'emailNNT'),
      maCQTNoiNop: layThe(xml, 'maCQTNoiNop'),
      tenCQTNoiNop: layThe(xml, 'tenCQTNoiNop'),
      nguoiKy: layThe(xml, 'nguoiKy'),
    },
    ct,
    plMua,
    plBan,
    ct9: ct9 === '' ? null : so(ct9),
  }
}
