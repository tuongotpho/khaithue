// Đi một vòng thật trên máy giả lập: đăng nhập -> lưu tờ khai + file Excel -> tải về -> dựng lại sổ
import { describe, expect, it } from 'vitest'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '../src/may/firebase'
import { datCoTraVe, luuChungTu, luuCongTy, luuDaXuat, luuTepHoaDon, luuToKhai, taiDuLieuMay, taiTep } from '../src/may/dongBo'
import { docTaiLieu } from '../src/core/taiLieu'
import { tinhTongQuan } from '../src/core/tongQuan'
import { docToKhai } from '../src/core/docToKhai'
import { dauKy, gopTuMay, khoTrong } from '../src/core/kho'

const xml = (ky: string, ct43: number, ct22 = 0) => `<?xml version="1.0" encoding="UTF-8"?><HSoThueDTu xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue"><HSoKhaiThue id="ID_1"><TTinChung><TTinTKhaiThue><TKhaiThue><maTKhai>842</maTKhai><loaiTKhai>C</loaiTKhai><soLan>0</soLan><KyKKhaiThue><kyKKhai>${ky}</kyKKhai></KyKKhaiThue><maCQTNoiNop>21701</maCQTNoiNop><tenCQTNoiNop>CQT</tenCQTNoiNop><nguoiKy>A</nguoiKy></TKhaiThue><NNT><mst>0100000000</mst><tenNNT>Cty Mẫu</tenNNT><dchiNNT>X</dchiNNT><maTinhNNT>217</maTinhNNT><tenTinhNNT>PT</tenTinhNNT></NNT></TTinTKhaiThue></TTinChung><CTieuTKhaiChinh><ct22>${ct22}</ct22><ct43>${ct43}</ct43></CTieuTKhaiChinh></HSoKhaiThue></HSoThueDTu>`

describe('Đồng bộ hồ sơ lên mây (máy giả lập)', () => {
  it('lưu rồi tải về dựng lại đúng sổ, đúng file', async () => {
    const { user } = await signInAnonymously(auth)
    const uid = user.uid

    const x1 = xml('1/2026', 500)
    const tk1 = docToKhai(x1)
    const id1 = await luuToKhai(uid, tk1, x1, 'q1.xml')
    const idTrung = await luuToKhai(uid, tk1, x1, 'q1-lan-2.xml') // nạp lại đúng file đó
    expect(idTrung).toBe(id1)
    const x1b = xml('1/2026', 0)
    const id1b = await luuToKhai(uid, docToKhai(x1b), x1b, 'q1-khac.xml')
    await datCoTraVe(uid, '0100000000', [id1], true) // bản [43]=500 bị CQT trả về
    await luuCongTy(uid, { hoSo: { ...tk1.hoSo, nguoiKy: 'Người ký sửa tay' }, kyNguon: '2026-Q1', suaTay: true })

    const excel = new TextEncoder().encode('gia lap file excel').buffer as ArrayBuffer
    await luuTepHoaDon(uid, '0100000000', 'DANH SÁCH HÓA ĐƠN (3).xlsx', excel, { quy: 2, nam: 2026 }, 2, 5, [
      { l: 'ban', mb: '0100000000', kh: 'C26TAA', so: '1', ng: '10/05/2026', ten: 'Khách', v: 100_000_000, t: 8_000_000, tt: 'Hóa đơn mới' },
    ])
    const ctXml = '<?xml version="1.0"?><CHUNGTU><SO_CTU>77</SO_CTU><MST_NNOP>0100000000</MST_NNOP><NGAY_LAP>31/07/2026</NGAY_LAP><TONG_TIEN>4000</TONG_TIEN><ROW_CTIET><MA_NDKT>1701</MA_NDKT><KY_THUE>00/Q2/2026</KY_THUE><TIEN_PNOP>4000</TIEN_PNOP></ROW_CTIET></CHUNGTU>'
    const tl = docTaiLieu(ctXml)
    if (tl.loai === 'chungTu') await luuChungTu(uid, tl.ct, ctXml, 'ct.xml')
    await luuDaXuat(uid, '0100000000', { quy: 2, nam: 2026 }, 'gtgt', '0100000000000-01_GTGT_TT80-Q22026-L00.xml', '<x/>', 123)

    const may = await taiDuLieuMay(uid)
    expect(may.congTy.map((c) => c.hoSo.nguoiKy)).toEqual(['Người ký sửa tay'])
    expect(may.toKhai.map((t) => t.id).sort()).toEqual([id1, id1b].sort())
    expect(may.tepHoaDon['0100000000']).toMatchObject([{ ten: 'DANH SÁCH HÓA ĐƠN (3).xlsx', ky: '2026-Q2', soBan: 2, soMua: 5 }])
    expect(may.daXuat['0100000000']).toMatchObject([{ loai: 'gtgt', ky: '2026-Q2', ct40: 123 }])

    // tải lại file gốc: đúng từng byte
    const ve = await taiTep(may.tepHoaDon['0100000000'][0].duongDan)
    expect(new TextDecoder().decode(ve)).toBe('gia lap file excel')
    const xmlVe = await taiTep(may.toKhai.find((t) => t.id === id1)!.duongDan)
    expect(new TextDecoder().decode(xmlVe)).toBe(x1)

    // dựng lại sổ: bỏ bản bị trả về -> [22] quý 2 = 0
    const kho = gopTuMay(khoTrong(), may.congTy, may.toKhai, may.chungTu, Object.entries(may.tepHoaDon).flatMap(([m, ds]) => ds.map((d) => ({ mst: m, hd: d.hd ?? [] }))))
    // chứng từ + hoá đơn rút gọn về đủ -> tổng quan quý 2/2026 thấy đã nộp 4.000 và 1 hoá đơn bán ra
    const q2 = tinhTongQuan(kho, '0100000000', new Date(2026, 9, 3)).quy.find((x) => x.khoa === '2026-Q2')!
    expect(q2.daNop).toBe(4000)
    expect(q2.hoaDon?.ban).toEqual({ n: 1, v: 100_000_000, t: 8_000_000 })
    expect(kho.congTy['0100000000'].hoSo.nguoiKy).toBe('Người ký sửa tay')
    expect(dauKy(kho, '0100000000', { quy: 2, nam: 2026 }).ct22).toBe(0)
  })
})
