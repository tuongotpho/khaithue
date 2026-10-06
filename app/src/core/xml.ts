// Tạo file XML tờ khai theo khuôn HTKK (namespace kekhaithue.gdt.gov.vn).
// File xuất ra CHƯA ký số — khi nộp trên thuedientu.gdt.gov.vn sẽ ký bằng USB token.

import type { HoSoDN, KyKeKhai, ToKhaiGTGT } from './types.js'
import { denNgay, ngayISO, tuNgay } from './ky.js'

/** Thông tin phần mềm ghi trong thẻ TTinDVu. Để ở một chỗ cho dễ đổi nếu cổng thuế yêu cầu khác. */
export const DICH_VU = {
  maDVu: 'HTKK',
  tenDVu: 'HỖ TRỢ KÊ KHAI THUẾ',
  pbanDVu: '5.7.3',
  ttinNhaCCapDVu: '',
}

export const MAU = {
  gtgt: {
    maTKhai: '842',
    tenTKhai: 'TỜ KHAI THUẾ GIÁ TRỊ GIA TĂNG (Mẫu số 01/GTGT)',
    pban: '2.8.3',
    maFile: '01_GTGT_TT80',
  },
  tncn: {
    maTKhai: '864',
    tenTKhai: 'TK khấu trừ thuế thu nhập cá nhân Mẫu 05/KK-TNCN (TT80/2021)',
    pban: '2.9.3',
    maFile: '05_KK_TNCN_TT80',
  },
}

const MO_TA = '(Ban hành kèm theo Thông tư số 80/2021/TT-BTC ngày 29 tháng 9 năm 2021 của Bộ trưởng Bộ Tài chính)'

export function esc(s: string | number) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** <tag>giá trị</tag> hoặc <tag/> khi rỗng */
const the = (tag: string, v: string | number | undefined | null) =>
  v === undefined || v === null || v === '' ? `<${tag}/>` : `<${tag}>${esc(v)}</${tag}>`

function phanChung(mau: { maTKhai: string; tenTKhai: string; pban: string }, ky: KyKeKhai, dn: HoSoDN, ngayLap: string, nnt: string) {
  return `<TTinChung>
<TTinDVu>
${the('maDVu', DICH_VU.maDVu)}
${the('tenDVu', DICH_VU.tenDVu)}
${the('pbanDVu', DICH_VU.pbanDVu)}
${the('ttinNhaCCapDVu', DICH_VU.ttinNhaCCapDVu)}
</TTinDVu>
<TTinTKhaiThue>
<TKhaiThue>
${the('maTKhai', mau.maTKhai)}
${the('tenTKhai', mau.tenTKhai)}
${the('moTaBMau', MO_TA)}
${the('pbanTKhaiXML', mau.pban)}
<loaiTKhai>C</loaiTKhai>
<soLan>0</soLan>
<KyKKhaiThue>
<kieuKy>Q</kieuKy>
${the('kyKKhai', `${ky.quy}/${ky.nam}`)}
${the('kyKKhaiTuNgay', tuNgay(ky))}
${the('kyKKhaiDenNgay', denNgay(ky))}
<kyKKhaiTuThang/>
<kyKKhaiDenThang/>
</KyKKhaiThue>
${the('maCQTNoiNop', dn.maCQTNoiNop)}
${the('tenCQTNoiNop', dn.tenCQTNoiNop)}
${the('ngayLapTKhai', ngayLap)}
<GiaHan>
<maLyDoGiaHan/>
<lyDoGiaHan/>
</GiaHan>
${the('nguoiKy', dn.nguoiKy)}
${the('ngayKy', ngayLap)}
<nganhNgheKD/>
</TKhaiThue>
<NNT>
${nnt}
</NNT>
</TTinTKhaiThue>
</TTinChung>`
}

function bocNgoai(noiDung: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<HSoKhaiThue id="ID_1">
${noiDung}
</HSoKhaiThue>
</HSoThueDTu>
`
}

export function xmlGTGT(tk: ToKhaiGTGT, ky: KyKeKhai, dn: HoSoDN, ngayLap = ngayISO()): string {
  const c = tk.ct
  const n = (k: string) => `<${k}>${c[k]}</${k}>`
  const nnt = [
    the('mst', dn.mst), the('tenNNT', dn.tenNNT), the('dchiNNT', dn.dchiNNT), the('phuongXa', dn.phuongXa),
    '<maHuyenNNT/>', '<tenHuyenNNT/>', the('maTinhNNT', dn.maTinhNNT), the('tenTinhNNT', dn.tenTinhNNT),
    the('dthoaiNNT', dn.dthoaiNNT), '<faxNNT/>', the('emailNNT', dn.emailNNT),
  ].join('\n')

  const coPhuLuc = tk.plBan.length > 0 || tk.plMua.length > 0
  const plMua = tk.plMua.length
    ? `<HH_DV_MuaVaoTrongKy>
${tk.plMua.map((d, i) => `<BangKeTenHHDV ID="ID_${i + 1}">
${the('tenHHDVMuaVao', d.ten)}
<giaTriHHDVMuaVao>${d.giaTri}</giaTriHHDVMuaVao>
<thueGTGTHHDV>${d.thue}</thueGTGTHHDV>
</BangKeTenHHDV>`).join('\n')}
<tongCongGiaTriHHDVMuaVao>${tk.tongPlMua.giaTri}</tongCongGiaTriHHDVMuaVao>
<tongCongThueGTGTHHDV>${tk.tongPlMua.thue}</tongCongThueGTGTHHDV>
</HH_DV_MuaVaoTrongKy>`
    : ''
  const plBan = tk.plBan.length
    ? `<HH_DV_BanRaTrongKy>
${tk.plBan.map((d, i) => `<BangKeTenHHDV ID="ID_${i + 1}">
${the('tenHHDV', d.ten)}
<giaTriHHDV>${d.giaTri}</giaTriHHDV>
<thueSuatTheoQuyDinh>${d.thueSuat}</thueSuatTheoQuyDinh>
<thueSuatSauGiam>${d.thueSuatSauGiam}</thueSuatSauGiam>
<thueGTGTDuocGiam>${d.thueGiam}</thueGTGTDuocGiam>
</BangKeTenHHDV>`).join('\n')}
<tongCongGiaTriHHDV>${tk.tongPlBan.giaTri}</tongCongGiaTriHHDV>
<tongCongThueGTGTDuocGiam>${tk.tongPlBan.thueGiam}</tongCongThueGTGTDuocGiam>
</HH_DV_BanRaTrongKy>`
    : ''

  const body = `${phanChung(MAU.gtgt, ky, dn, ngayLap, nnt)}
<CTieuTKhaiChinh>
<ma_NganhNghe>00</ma_NganhNghe>
<ten_NganhNghe>Hoạt động sản xuất kinh doanh thông thường</ten_NganhNghe>
<tieuMucHachToan>1701</tieuMucHachToan>
<Header>
<ct09/>
<ct10/>
<DiaChiHDSXKDKhacTinhNDTSC>
<ct11a_phuongXa_ma/>
<ct11a_phuongXa_ten/>
<ct11b_quanHuyen_ma/>
<ct11b_quanHuyen_ten/>
<ct11c_tinhTP_ma/>
<ct11c_tinhTP_ten/>
</DiaChiHDSXKDKhacTinhNDTSC>
</Header>
<ct21>${c.ct21 ? 1 : 0}</ct21>
${n('ct22')}
<GiaTriVaThueGTGTHHDVMuaVao>
${n('ct23')}
${n('ct24')}
</GiaTriVaThueGTGTHHDVMuaVao>
<HangHoaDichVuNhapKhau>
${n('ct23a')}
${n('ct24a')}
</HangHoaDichVuNhapKhau>
${n('ct25')}
${n('ct26')}
<HHDVBRaChiuThueGTGT>
${n('ct27')}
${n('ct28')}
</HHDVBRaChiuThueGTGT>
${n('ct29')}
<HHDVBRaChiuTSuat5>
${n('ct30')}
${n('ct31')}
</HHDVBRaChiuTSuat5>
<HHDVBRaChiuTSuat10>
${n('ct32')}
${n('ct33')}
</HHDVBRaChiuTSuat10>
${n('ct32a')}
<TongDThuVaThueGTGTHHDVBRa>
${n('ct34')}
${n('ct35')}
</TongDThuVaThueGTGTHHDVBRa>
${['ct36', 'ct37', 'ct38', 'ct39a', 'ct40a', 'ct40b', 'ct40', 'ct41', 'ct42', 'ct43'].map(n).join('\n')}
</CTieuTKhaiChinh>
${coPhuLuc ? `<PLuc>
<PL_NQ142_GTGT>
${[plMua, plBan].filter(Boolean).join('\n')}
<ChenhLech>
<ct9>${tk.ct9}</ct9>
</ChenhLech>
</PL_NQ142_GTGT>
</PLuc>` : '<PLuc/>'}`
  return dinhDang(bocNgoai(body))
}

export function xmlTNCN(ct: Record<string, number>, ky: KyKeKhai, dn: HoSoDN, ngayLap = ngayISO()): string {
  const nnt = [
    the('mst', dn.mst), the('tenNNT', dn.tenNNT), the('dchiNNT', dn.dchiNNT), the('tenXaNNT', dn.phuongXa),
    the('maXaNNT', dn.maXaNNT), '<maHuyenNNT/>', '<tenHuyenNNT/>', the('maTinhNNT', dn.maTinhNNT),
    the('tenTinhNNT', dn.tenTinhNNT), the('dthoaiNNT', dn.dthoaiNNT), '<faxNNT/>', the('emailNNT', dn.emailNNT),
  ].join('\n')
  const ten = ['ct15', 'ct16', 'ct17', 'ct18', 'ct19', 'ct20', 'ct21', 'ct22', 'ct23', 'ct24', 'ct25', 'ct25_1', 'ct26', 'ct27', 'ct28', 'ct29', 'ct30', 'ct31', 'ct32']
  const body = `${phanChung(MAU.tncn, ky, dn, ngayLap, nnt)}
<CTieuTKhaiChinh>
${the('mst_cu', dn.mst)}
${ten.map((k) => `<${k}>${ct[k] ?? 0}</${k}>`).join('\n')}
</CTieuTKhaiChinh>
<PLuc/>`
  return dinhDang(bocNgoai(body))
}

/** Thụt lề 2 dấu cách cho dễ đọc, giống file HTKK */
function dinhDang(xml: string): string {
  let cap = 0
  return xml
    .split('\n')
    .map((dong) => {
      const d = dong.trim()
      if (!d) return ''
      if (d.startsWith('</')) cap--
      const ra = d.startsWith('<?') ? d : '  '.repeat(Math.max(cap, 0)) + d
      // dòng chỉ có thẻ mở (không tự đóng, không có thẻ đóng) thì tăng cấp
      if (/^<[^/?!][^>]*[^/]>$/.test(d) && !d.includes('</')) cap++
      return ra
    })
    .filter(Boolean)
    .join('\n') + '\n'
}

/** Tên file theo cách HTKK đặt: <MST>000-01_GTGT_TT80-Q22026-L00.xml */
export function tenFileXML(loai: 'gtgt' | 'tncn', ky: KyKeKhai, mst: string) {
  return `${mst}000-${MAU[loai].maFile}-Q${ky.quy}${ky.nam}-L00.xml`
}
