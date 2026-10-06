// Các "công cụ" AI gọi được — mỗi hàm nhận dữ liệu đã nạp + tham số, trả về đối tượng thuần (JSON).
// KHÔNG tự tính lại thuế: mọi con số đi qua đúng các hàm app đang dùng (src/core), nên AI và app luôn ra cùng một số.

import * as fs from 'node:fs'
import * as path from 'node:path'
import { conHieuLuc, gopHoaDon, kiemSoHoaDonBan } from '../src/core/excel.js'
import { kiemDauKy, NHAP_TAY_TRONG, tinhGTGT, type NhapTayGTGT } from '../src/core/gtgt.js'
import { dauKy, khoaKy, kyTruoc, soCai, tinhTrangKy, type Kho } from '../src/core/kho.js'
import { hanNop, quyCanKhai } from '../src/core/ky.js'
import { NHAN_GTGT } from '../src/core/nhan.js'
import { daXacNhan, tenTieuMuc, kyCuaChungTu } from '../src/core/taiLieu.js'
import { tinhDoiSoat, tinhDoiTac, tinhTongQuan } from '../src/core/tongQuan.js'
import type { CanhBao, HoaDon, KyKeKhai } from '../src/core/types.js'
import { tenFileXML, xmlGTGT } from '../src/core/xml.js'

export class LoiNguoiDung extends Error {}

/** Dữ liệu đã nạp — từ thư mục trên máy (nguon.ts) hoặc từ mây (may/khoMay.ts) */
export interface DuLieu {
  kho: Kho
  /** Hoá đơn ĐẦY ĐỦ từ danh sách Excel (đã xếp bán/mua) — để lập tờ khai giống hệt app */
  hoaDon: Record<string, HoaDon[]>
  /** Báo cáo lần nạp: nguồn, số file, lỗi... (hình dạng tuỳ nguồn) */
  baoCao: Record<string, unknown>
}

/** Công ty đang hỏi: truyền MST thì dùng MST đó, không thì công ty mặc định của sổ */
export function chonMst(kho: Kho, mst?: string): string {
  const m = mst?.trim() || kho.chon
  if (!m) throw new LoiNguoiDung('Chưa nạp được công ty nào — kiểm cấu hình thư mục (gọi nap_ho_so để xem báo cáo).')
  if (!kho.congTy[m] && !kho.hoaDon?.[m]) throw new LoiNguoiDung(`Không có công ty MST ${m}. Các MST đang có: ${Object.keys(kho.congTy).join(', ') || '(trống)'}`)
  return m
}

const kyTu = (quy?: number, nam?: number): KyKeKhai => {
  if (quy === undefined && nam === undefined) return quyCanKhai()
  if (!quy || !nam) throw new LoiNguoiDung('Cần cả quý (1–4) và năm, hoặc bỏ trống cả hai để lấy quý vừa kết thúc.')
  return { quy: quy as 1 | 2 | 3 | 4, nam }
}

const chu = (c: CanhBao) => `${c.muc === 'loi' ? '⛔ LỖI' : '⚠️ Chú ý'}: ${c.noiDung}`
const quyCuaNgay = (ngay: string) => {
  const m = /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(ngay)
  return m ? `${m[2]}-Q${Math.ceil(Number(m[1]) / 3)}` : null
}

export function baoCaoNap(d: DuLieu) {
  return {
    ...d.baoCao,
    congTy: Object.values(d.kho.congTy).map((c) => ({ mst: c.hoSo.mst, ten: c.hoSo.tenNNT })),
    congTyMacDinh: d.kho.chon,
  }
}

export function danhSachCongTy(d: DuLieu) {
  return Object.values(d.kho.congTy).map((c) => {
    const mst = c.hoSo.mst
    return {
      ...c.hoSo,
      macDinh: mst === d.kho.chon,
      soQuyGTGT: Object.keys(d.kho.gtgt[mst] ?? {}).length,
      soQuyTNCN: Object.keys(d.kho.tncn[mst] ?? {}).length,
      soHoaDon: Object.keys(d.kho.hoaDon?.[mst] ?? {}).length,
      soChungTu: Object.keys(d.kho.chungTu?.[mst] ?? {}).length,
    }
  })
}

export function tongQuan(d: DuLieu, a: { mst?: string; ngay_hom_nay?: string }) {
  const mst = chonMst(d.kho, a.mst)
  const tq = tinhTongQuan(d.kho, mst, a.ngay_hom_nay ? new Date(a.ngay_hom_nay) : new Date())
  return {
    mst,
    hanToi: tq.hanToi,
    canhBao: tq.canhBao.map(chu),
    nam: tq.nam,
    quy: tq.quy.map((q) => ({
      quy: q.khoa,
      hanNop: q.hanNop,
      quaHan: q.quaHan,
      coToKhai: !!q.hieuLuc,
      banHieuLuc: q.hieuLuc ? `${q.hieuLuc.loaiTKhai === 'B' ? `bổ sung lần ${q.hieuLuc.soLan}` : 'lần đầu'} (${q.hieuLuc.tenFile})` : null,
      biTraVe: q.biTraVe,
      coTNCN: q.coTNCN,
      doanhThu_ct34: q.hieuLuc?.ct34 ?? null,
      phaiNop_ct40: q.phaiNop,
      daNop: q.daNop,
      chuyenKySau_ct43: q.hieuLuc?.ct43 ?? null,
      hoaDon: q.hoaDon,
      khopDauKy: q.khopDauKy,
    })),
    // Mọi khoản đã nộp ngân sách (GTGT, TNDN, môn bài, chậm nộp...) cộng theo NĂM NỘP trên chứng từ
    nopNganSachTheoNam: tq.nopTheoNam,
    toKhaiKhac: tq.khac.map((k) => ({ ten: k.tenTKhai || `mã ${k.maTKhai}`, ky: k.ky, loai: k.loaiTKhai, lan: k.soLan, ngayLap: k.ngayLap, file: k.tenFile })),
  }
}

export function soTheoDoi(d: DuLieu, a: { mst?: string }) {
  const mst = chonMst(d.kho, a.mst)
  return {
    mst,
    quyTac: '[22] quý này phải = [43] trên tờ khai LẦN ĐẦU quý liền trước (quy tắc cơ quan thuế).',
    gtgt: soCai(d.kho, mst).map((r) => {
      const tt = tinhTrangKy(d.kho, mst, r.khoa)
      return {
        quy: r.khoa,
        khopDauKyVoiQuyTruoc: r.khop,
        coNhieuBanLanDauKhacSo: tt.xungDot,
        phienBan: r.ds.map((p) => ({
          loai: p.loaiTKhai === 'B' ? `bổ sung lần ${p.soLan}` : 'lần đầu',
          ngayLap: p.ngayLap, ct22: p.ct22, ct23: p.ct23, ct24: p.ct24, ct34: p.ct34, ct35: p.ct35, ct36: p.ct36, ct40: p.ct40, ct41: p.ct41, ct43: p.ct43,
          biTraVe: !!p.khongChapNhan, nguon: p.nguon === 'app' ? 'app xuất (chưa có file đã nộp)' : 'file XML đã nộp', file: p.tenFile,
        })),
      }
    }),
    tncn: Object.entries(d.kho.tncn[mst] ?? {}).sort(([x], [y]) => x.localeCompare(y)).map(([quy, ct]) => ({
      quy, soNguoiLaoDong_ct16: ct.ct16, tongThuNhap_ct21: ct.ct21, thueDaKhauTru_ct29: ct.ct29,
    })),
  }
}

export interface ThamSoLapGTGT {
  quy?: number
  nam?: number
  mst?: string
  /** Chỉ tiêu nhập tay: ct26, ct32a, ct37, ct38, ct39a, ct40b, ct42, ct23a, ct24a, ct21 */
  nhap_tay?: Partial<NhapTayGTGT>
  /** Ghi đè [22] (mặc định = [43] tờ khai lần đầu quý trước) — chỉ khi cán bộ thuế hướng dẫn */
  ct22?: number
  /** Hoá đơn ngoài quý vẫn muốn tính, dạng "ký hiệu-số" (vd "C26TKL-18") hoặc chỉ số */
  them_ngoai_ky?: string[]
  /** Hoá đơn trong quý muốn bỏ ra, cùng dạng trên */
  bo_hoa_don?: string[]
  ngay_lap?: string
}

const trungMa = (h: HoaDon, ds?: string[]) => !!ds?.some((x) => x === `${h.kyHieu}-${h.so}` || x === h.so || Number(x) === Number(h.so))

export function lapToKhaiGTGT(d: DuLieu, a: ThamSoLapGTGT) {
  const mst = chonMst(d.kho, a.mst)
  const ky = kyTu(a.quy, a.nam)
  const hoSo = d.kho.congTy[mst]?.hoSo
  const gop = gopHoaDon(d.hoaDon[mst] ?? [], ky)
  const ban = [...gop.ban.filter((h) => !trungMa(h, a.bo_hoa_don)), ...gop.ngoaiKy.filter((h) => h.loai === 'ban' && trungMa(h, a.them_ngoai_ky))]
  const mua = [...gop.mua.filter((h) => !trungMa(h, a.bo_hoa_don)), ...gop.ngoaiKy.filter((h) => h.loai === 'mua' && trungMa(h, a.them_ngoai_ky))]

  const dk = dauKy(d.kho, mst, ky)
  const ct22 = a.ct22 ?? dk.ct22 ?? 0
  const kq = tinhGTGT(ban, mua, { ...NHAP_TAY_TRONG, ...a.nhap_tay, ct22 })
  const qt = kyTruoc(ky)
  const canhBao: CanhBao[] = [
    ...(dk.xungDot ? [{ muc: 'loi' as const, noiDung: dk.ghiChu }] : []),
    ...kiemDauKy(ct22, dk.ct22, `${qt.quy}/${qt.nam}`, dk.chenhBoSung),
    ...kiemSoHoaDonBan(ban),
    ...kq.canhBao,
  ]
  if (!hoSo) canhBao.unshift({ muc: 'loi', noiDung: `Chưa có thông tin công ty MST ${mst} — cần ít nhất một tờ khai XML đã nộp trong thư mục nguồn.` })
  else if (!hoSo.maCQTNoiNop || !hoSo.tenCQTNoiNop || !hoSo.nguoiKy || !hoSo.maTinhNNT) canhBao.unshift({ muc: 'loi', noiDung: 'Thiếu thông tin cơ quan thuế / người ký trong hồ sơ công ty.' })
  if (!d.hoaDon[mst]?.length) canhBao.push({ muc: 'chu_y', noiDung: 'Chưa có file Excel "Danh sách hoá đơn" nào trong thư mục nguồn — tờ khai đang tính với 0 hoá đơn.' })
  const phu = d.kho.phuSong?.[mst]
  if (phu) {
    const thang = [0, 1, 2].map((i) => `${ky.nam}-${String((ky.quy - 1) * 3 + 1 + i).padStart(2, '0')}`)
    for (const l of ['ban', 'mua'] as const) {
      const thieu = thang.filter((t) => !phu[l].includes(t))
      if (thieu.length) canhBao.push({ muc: 'chu_y', noiDung: `Chưa có danh sách hoá đơn ${l === 'ban' ? 'BÁN RA' : 'MUA VÀO'} tháng ${thieu.join(', ')} — có thể thiếu hoá đơn.` })
    }
  }

  const ct = kq.toKhai.ct
  const daNop = d.kho.gtgt[mst]?.[khoaKy(ky)]?.filter((p) => p.nguon === 'xml' && !p.khongChapNhan) ?? []
  const tomTatHD = (ds: HoaDon[]) => ({ soHoaDon: ds.length, chuaThue: ds.reduce((s, h) => s + h.chuaThue, 0), thue: ds.reduce((s, h) => s + h.thue, 0) })
  return {
    mst,
    ky: `${ky.quy}/${ky.nam}`,
    hanNop: hanNop(ky),
    coLoi: canhBao.some((c) => c.muc === 'loi'),
    canhBao: canhBao.map(chu),
    dauKy: { ct22, ct22TheoQuyTac: dk.ct22, ghiChu: dk.ghiChu || null, chenhBoSungQuyTruoc: dk.chenhBoSung },
    chiTieu: NHAN_GTGT.map(([k, ten]) => ({ ma: `[${k.slice(2)}]`, ten, giaTri: ct[k] ?? 0 })),
    phuLuc: {
      mucI_muaVao8: kq.toKhai.plMua, tongMucI: kq.toKhai.tongPlMua,
      mucII_banRaDuocGiam: kq.toKhai.plBan, tongMucII: kq.toKhai.tongPlBan,
      ct9: kq.toKhai.ct9,
    },
    hoaDon: {
      banRa: tomTatHD(ban), muaVao: tomTatHD(mua),
      ngoaiKyChuaTinh: gop.ngoaiKy.filter((h) => !trungMa(h, a.them_ngoai_ky)).map((h) => `${h.loai === 'ban' ? 'bán' : 'mua'} ${h.kyHieu}-${h.so} ${h.ngay} ${h.chuaThue}`).slice(0, 30),
      soNgoaiKyChuaTinh: gop.ngoaiKy.filter((h) => !trungMa(h, a.them_ngoai_ky)).length,
      boQuaDoThayTheHuy: gop.boQua.length,
      trungGiuaCacFile: gop.trung,
    },
    soVoiToKhaiDaNop: daNop.map((p) => ({
      loai: p.loaiTKhai === 'B' ? `bổ sung lần ${p.soLan}` : 'lần đầu', file: p.tenFile,
      lech: Object.fromEntries((['ct22', 'ct23', 'ct24', 'ct34', 'ct35', 'ct36', 'ct40', 'ct41', 'ct43'] as const)
        .filter((k) => p[k] !== undefined && p[k] !== ct[k]).map((k) => [k, { daNop: p[k], appTinh: ct[k] }])),
    })),
    // dùng nội bộ để xuất XML
    _toKhai: kq.toKhai,
    _ky: ky,
  }
}

export function xuatXmlGTGT(d: DuLieu, a: ThamSoLapGTGT, thuMucXuat: string) {
  const r = lapToKhaiGTGT(d, a)
  const { _toKhai, _ky, ...kq } = r
  if (r.coLoi) return { daGhi: false, lyDo: 'Tờ khai còn LỖI (⛔) — app cũng khoá nút xuất trong trường hợp này. Sửa các lỗi rồi xuất lại.', ...kq }
  const hoSo = d.kho.congTy[r.mst].hoSo
  const ten = tenFileXML('gtgt', _ky, hoSo.mst)
  fs.mkdirSync(thuMucXuat, { recursive: true })
  const duongDan = path.join(thuMucXuat, ten)
  fs.writeFileSync(duongDan, xmlGTGT(_toKhai, _ky, hoSo, a.ngay_lap), 'utf8')
  return {
    daGhi: true,
    file: duongDan,
    nhacNho: 'File CHƯA ký số. Người nộp tự mở thuedientu.gdt.gov.vn → Nộp tờ khai XML → ký bằng USB token. Nộp xong kéo file đã nộp vào thư mục nguồn để sổ ghi nhận.',
    ...kq,
  }
}

export function traHoaDon(d: DuLieu, a: { mst?: string; quy?: number; nam?: number; loai?: 'ban' | 'mua'; tim?: string; ca_huy?: boolean; gioi_han?: number }) {
  const mst = chonMst(d.kho, a.mst)
  const tim = a.tim?.trim().toLowerCase()
  let ds = Object.values(d.kho.hoaDon?.[mst] ?? {})
  if (!a.ca_huy) ds = ds.filter((h) => conHieuLuc({ trangThai: h.tt } as HoaDon))
  if (a.loai) ds = ds.filter((h) => h.l === a.loai)
  if (a.nam) ds = ds.filter((h) => h.ng.endsWith(String(a.nam)))
  if (a.quy && a.nam) ds = ds.filter((h) => quyCuaNgay(h.ng) === `${a.nam}-Q${a.quy}`)
  if (tim) ds = ds.filter((h) => [h.ten, h.mb, h.mm ?? '', `${h.kh}-${h.so}`, h.so].some((x) => x.toLowerCase().includes(tim)))
  const ngaySo = (s: string) => s.split('/').reverse().join('')
  ds.sort((x, y) => ngaySo(x.ng).localeCompare(ngaySo(y.ng)) || x.kh.localeCompare(y.kh) || Number(x.so) - Number(y.so))
  const gioiHan = Math.min(a.gioi_han ?? 50, 500)
  return {
    mst,
    tongSoKhop: ds.length,
    tong: { chuaThue: ds.reduce((s, h) => s + h.v, 0), thue: ds.reduce((s, h) => s + h.t, 0) },
    hienThi: Math.min(gioiHan, ds.length),
    hoaDon: ds.slice(0, gioiHan).map((h) => ({
      loai: h.l === 'ban' ? 'bán ra' : 'mua vào', kyHieu: h.kh, so: h.so, ngay: h.ng, doiTac: h.ten,
      mstDoiTac: h.l === 'ban' ? h.mm ?? '' : h.mb, chuaThue: h.v, thue: h.t, trangThai: h.tt, chiTuXmlLe: h.x === 1,
    })),
  }
}

export function doiTac(d: DuLieu, a: { mst?: string; nam?: number; top?: number }) {
  const mst = chonMst(d.kho, a.mst)
  const r = tinhDoiTac(d.kho, mst, a.nam ?? null)
  const top = a.top ?? 20
  return {
    mst,
    nam: a.nam ?? 'tất cả',
    tongBan: r.tongBan, tongMua: r.tongMua,
    soKhachHang: r.ban.length, soNhaCungCap: r.mua.length,
    khachHang: r.ban.slice(0, top),
    nhaCungCap: r.mua.slice(0, top),
    nguonTungQuy: r.nguonQuy,
  }
}

export function doiSoat(d: DuLieu, a: { mst?: string; quy?: number; nam?: number; chi_lech?: boolean }) {
  const mst = chonMst(d.kho, a.mst)
  let ds = tinhDoiSoat(d.kho, mst)
  if (a.nam) ds = ds.filter((q) => q.khoa.startsWith(`${a.nam}-`))
  if (a.quy && a.nam) ds = ds.filter((q) => q.khoa === `${a.nam}-Q${a.quy}`)
  if (a.chi_lech) ds = ds.filter((q) => q.ban.lech || q.mua.lech || q.doiTac.length)
  return {
    mst,
    giaiThich: 'tk = số trên tờ khai đang hiệu lực ([34] bán ra / [23] mua vào); hd = tổng hoá đơn còn hiệu lực; lech = hd − tk. doiTac: đối tác lệch giữa phụ lục giảm thuế và hoá đơn 8%.',
    quy: ds,
  }
}

export function chungTuNopTien(d: DuLieu, a: { mst?: string; nam?: number }) {
  const mst = chonMst(d.kho, a.mst)
  let ds = Object.values(d.kho.chungTu?.[mst] ?? {})
  if (a.nam) ds = ds.filter((c) => c.ngay.endsWith(String(a.nam)) || c.dong.some((x) => kyCuaChungTu(x.kyThue).startsWith(String(a.nam))))
  ds.sort((x, y) => x.ngay.split('/').reverse().join('').localeCompare(y.ngay.split('/').reverse().join('')))
  return {
    mst,
    // Chỉ cộng chứng từ đã có số (giấy nộp tiền chưa được ngân hàng/kho bạc xác nhận thì không tính)
    tong: ds.filter(daXacNhan).reduce((s, c) => s + c.tong, 0),
    chungTu: ds.map((c) => ({
      so: c.so, ngay: c.ngay, tong: c.tong, ...(daXacNhan(c) ? {} : { chuaXacNhan: 'không có số chứng từ — không tính là đã nộp' }),
      dong: c.dong.map((x) => ({ loai: tenTieuMuc(x.ndkt), tieuMuc: x.ndkt, kyThue: kyCuaChungTu(x.kyThue), tien: x.tien, noiDung: x.noiDung })),
    })),
  }
}
