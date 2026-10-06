// Công cụ GHI lên mây cho AI — làm đúng như web app làm khi người dùng kéo file vào / bấm nút:
//   nạp file (tờ khai, chứng từ, hoá đơn XML, Excel hoá đơn), đánh dấu CQT trả về, sửa thông tin công ty,
//   lưu tờ khai đã lập, và XOÁ một tài liệu (phải xác nhận bằng đúng tên file).
// Mọi lần ghi / xoá đều để lại một dòng nhật ký (nguoiDung/{uid}/nhatKyAI) — xem được trên web app.

import * as XLSX from 'xlsx'
import { docTep, phanLoai, phuSongFile, quyNhieuNhat, type TepHoaDon } from '../../src/core/excel.js'
import { napTaiLieu, rutGonHoaDon } from '../../src/core/kho.js'
import { docTaiLieu } from '../../src/core/taiLieu.js'
import type { HoSoDN } from '../../src/core/types.js'
import { tenFileXML, xmlGTGT } from '../../src/core/xml.js'
import { chonMst, lapToKhaiGTGT, LoiNguoiDung, type DuLieu, type ThamSoLapGTGT } from '../congCu.js'
import type { FirebaseNguoiDung } from './firebaseRest.js'
import * as km from './khoMay.js'

export interface NguCanhMay {
  fb: FirebaseNguoiDung
  may: km.DuLieuMay
  du: DuLieu
  phien: { ma: string; tenMay: string }
}

const nhatKy = (n: NguCanhMay, congCu: string, moTa: string) => km.ghiNhatKy(n.fb, n.phien.ma, n.phien.tenMay, congCu, moTa)

/** Mọi tài liệu đã lưu trên mây, kèm mã (id) — để đánh dấu / xoá đúng cái */
export function danhSachTaiLieu(n: NguCanhMay, a: { mst?: string; nhom?: km.NhomTaiLieu }) {
  const mst = chonMst(n.du.kho, a.mst)
  const nhom = (x: km.NhomTaiLieu) => !a.nhom || a.nhom === x
  return {
    mst,
    toKhai: nhom('toKhai') ? n.may.toKhai.filter((t) => t.mst === mst).sort((x, y) => y.ky.localeCompare(x.ky)).map((t) => ({
      nhom: 'toKhai', id: t.id, tenFile: t.tenFile, mau: t.tenTKhai || (t.maTKhai === '842' ? '01/GTGT' : t.maTKhai === '864' ? '05/KK-TNCN' : `mã ${t.maTKhai}`),
      ky: t.ky, loai: t.loaiTKhai === 'B' ? `bổ sung lần ${t.soLan}` : 'lần đầu', ngayLap: t.ngayLap, biTraVe: !!t.khongChapNhan,
    })) : undefined,
    tepHoaDon: nhom('tepHoaDon') ? (n.may.tepHoaDon[mst] ?? []).map((d) => ({ nhom: 'tepHoaDon', id: d.id, tenFile: d.ten, ky: d.ky, soBan: d.soBan, soMua: d.soMua })) : undefined,
    chungTu: nhom('chungTu') ? n.may.chungTu.filter((c) => c.mst === mst).map((c) => ({ nhom: 'chungTu', id: c.id, tenFile: c.tenFile, so: c.so, ngay: c.ngay, tong: c.tong })) : undefined,
    daXuat: nhom('daXuat') ? (n.may.daXuat[mst] ?? []).map((d) => ({ nhom: 'daXuat', id: d.id, tenFile: d.tenFile, loai: d.loai, ky: d.ky, ct40: d.ct40 })) : undefined,
  }
}

/** Nạp MỘT file lên mây: XML (gửi nguyên văn) hoặc Excel/CSV (gửi base64) */
export async function napTaiLieuLenMay(n: NguCanhMay, a: { ten_file: string; noi_dung?: string; noi_dung_base64?: string }) {
  const ten = a.ten_file.trim()
  if (!ten) throw new LoiNguoiDung('Thiếu tên file')
  let k = n.du.kho

  if (/\.xml$/i.test(ten)) {
    const text = a.noi_dung ?? (a.noi_dung_base64 ? Buffer.from(a.noi_dung_base64, 'base64').toString('utf8') : '')
    if (!text.trim()) throw new LoiNguoiDung('File XML rỗng — gửi nội dung vào noi_dung')
    const tl = docTaiLieu(text)
    const r = napTaiLieu(k, tl, ten)
    if (r.loi) throw new LoiNguoiDung(`Không nạp: ${r.moTa}`)
    k = r.kho
    let mst = ''
    if (tl.loai === 'toKhai') {
      mst = tl.tk.hoSo.mst
      await km.luuCongTy(n.fb, k.congTy[mst])
      await km.luuToKhai(n.fb, tl.tk, text, ten, { tenTKhai: tl.tenTKhai, kyChu: tl.kyChu })
    } else if (tl.loai === 'chungTu') {
      mst = tl.ct.mst
      if (!n.du.kho.congTy[mst]) throw new LoiNguoiDung(`Chứng từ của MST ${mst} — chưa có công ty này trên mây. Nạp một tờ khai XML của công ty trước.`)
      await km.luuChungTu(n.fb, tl.ct, text, ten)
    } else if (tl.loai === 'hoaDon') {
      mst = k.congTy[tl.hd.mstBan] ? tl.hd.mstBan : tl.hd.mstMua
      const loai = mst === tl.hd.mstBan ? 'ban' : 'mua'
      await km.luuTepHoaDon(n.fb, mst, ten, new TextEncoder().encode(text), quyNhieuNhat([tl.hd]), loai === 'ban' ? 1 : 0, loai === 'mua' ? 1 : 0, rutGonHoaDon([{ ...tl.hd, loai }], true))
    }
    await nhatKy(n, 'nap_tai_lieu', `${ten}: ${r.moTa}`)
    return { daLuu: true, mst, moTa: r.moTa }
  }

  if (/\.(xlsx|xls|csv)$/i.test(ten)) {
    if (!a.noi_dung_base64 && !(a.noi_dung && /\.csv$/i.test(ten))) throw new LoiNguoiDung('File Excel phải gửi dạng base64 trong noi_dung_base64')
    const du = a.noi_dung_base64 ? new Uint8Array(Buffer.from(a.noi_dung_base64, 'base64')) : new TextEncoder().encode(a.noi_dung!)
    const wb = /\.csv$/i.test(ten) ? XLSX.read(new TextDecoder().decode(du), { type: 'string', raw: true }) : XLSX.read(du)
    const ts = wb.SheetNames.map((sh) => docTep(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sh], { header: 1, raw: true, defval: null }) as never, ten)).filter((t): t is TepHoaDon => !!t && t.hoaDon.length > 0)
    if (!ts.length) throw new LoiNguoiDung(`${ten}: không phải file "Danh sách hóa đơn" (hoặc không có dòng hoá đơn nào)`)
    const mst = k.chon && phanLoai(ts, k.chon).hoaDon.length ? k.chon : phanLoai(ts, null).mst
    if (!mst || !k.congTy[mst]) throw new LoiNguoiDung(`Chưa rõ hoá đơn của công ty nào${mst ? ` (MST ${mst} chưa có trên mây)` : ''} — nạp tờ khai XML của công ty trước.`)
    const p = phanLoai(ts, mst)
    const soBan = p.hoaDon.filter((h) => h.loai === 'ban').length
    await km.luuTepHoaDon(n.fb, mst, ten, du, quyNhieuNhat(p.hoaDon), soBan, p.hoaDon.length - soBan, rutGonHoaDon(p.hoaDon), phuSongFile(ts, mst))
    const moTa = `${soBan} hoá đơn bán ra, ${p.hoaDon.length - soBan} mua vào`
    await nhatKy(n, 'nap_tai_lieu', `${ten}: ${moTa}`)
    return { daLuu: true, mst, moTa, canhBao: p.canhBao.map((c) => c.noiDung) }
  }
  throw new LoiNguoiDung('Chỉ nhận .xml, .xlsx, .xls, .csv')
}

/** Đánh dấu / bỏ đánh dấu "cơ quan thuế trả về" cho một phiên bản tờ khai 01/GTGT */
export async function danhDauTraVe(n: NguCanhMay, a: { quy: number; nam: number; ten_file: string; tra_ve: boolean; mst?: string }) {
  const mst = chonMst(n.du.kho, a.mst)
  const khoa = `${a.nam}-Q${a.quy}`
  const ds = n.du.kho.gtgt[mst]?.[khoa] ?? []
  const pb = ds.find((p) => p.tenFile === a.ten_file) ?? n.may.toKhai.filter((t) => t.tenFile === a.ten_file && t.ky === khoa).map((t) => ds.find((p) => p.ids?.includes(t.id)))[0]
  if (!pb?.ids?.length) throw new LoiNguoiDung(`Quý ${a.quy}/${a.nam} không có tờ khai 01/GTGT tên "${a.ten_file}". Các file đang có: ${ds.map((p) => p.tenFile).join(', ') || '(không có)'}`)
  await km.datCoTraVe(n.fb, mst, pb.ids, a.tra_ve)
  await nhatKy(n, 'danh_dau_tra_ve', `${a.tra_ve ? 'Đánh dấu' : 'Bỏ đánh dấu'} CQT trả về: ${a.ten_file} (quý ${a.quy}/${a.nam})`)
  return { daLuu: true, file: a.ten_file, biTraVe: a.tra_ve, soBanGhi: pb.ids.length }
}

const O_HO_SO: (keyof HoSoDN)[] = ['tenNNT', 'dchiNNT', 'phuongXa', 'maXaNNT', 'maTinhNNT', 'tenTinhNNT', 'dthoaiNNT', 'emailNNT', 'maCQTNoiNop', 'tenCQTNoiNop', 'nguoiKy']

export async function suaThongTinCongTy(n: NguCanhMay, a: Partial<HoSoDN> & { mst?: string }) {
  const mst = chonMst(n.du.kho, a.mst)
  const cu = n.du.kho.congTy[mst]
  if (!cu) throw new LoiNguoiDung(`Chưa có công ty ${mst}`)
  const doi = O_HO_SO.filter((k) => a[k] !== undefined && a[k] !== cu.hoSo[k])
  if (!doi.length) return { daLuu: false, lyDo: 'Không có ô nào thay đổi' }
  const hoSo = { ...cu.hoSo, ...Object.fromEntries(doi.map((k) => [k, a[k]])) }
  // Sửa tay thì tờ khai XML nạp sau không ghi đè (giống nút "Sửa thông tin" trên web app)
  await km.luuCongTy(n.fb, { hoSo, kyNguon: cu.kyNguon, suaTay: true })
  await nhatKy(n, 'sua_thong_tin_cong_ty', `Sửa ${doi.map((k) => `${k}: "${cu.hoSo[k]}" → "${a[k]}"`).join('; ')}`)
  return { daLuu: true, daSua: doi }
}

/** Lập tờ khai rồi lưu file XML (chưa ký) vào mục "đã xuất" trên mây; trả nội dung XML để AI lưu ra máy nếu cần */
export async function luuXmlGTGT(n: NguCanhMay, a: ThamSoLapGTGT) {
  const { _toKhai, _ky, ...kq } = lapToKhaiGTGT(n.du, a)
  if (kq.coLoi) return { daLuu: false, lyDo: 'Tờ khai còn LỖI (⛔) — web app cũng khoá nút xuất trong trường hợp này.', ...kq }
  const hoSo = n.du.kho.congTy[kq.mst].hoSo
  const ten = tenFileXML('gtgt', _ky, hoSo.mst)
  const xml = xmlGTGT(_toKhai, _ky, hoSo, a.ngay_lap)
  await km.luuDaXuat(n.fb, kq.mst, _ky, 'gtgt', ten, xml, _toKhai.ct.ct40)
  await nhatKy(n, 'luu_xml_gtgt', `Lập tờ khai 01/GTGT quý ${kq.ky}: [40] = ${_toKhai.ct.ct40}, lưu ${ten}`)
  return {
    daLuu: true, tenFile: ten, xml,
    nhacNho: 'File CHƯA ký số. Người nộp tự ký bằng USB token và nộp trên thuedientu.gdt.gov.vn. Nộp xong nạp lại file đã nộp để sổ ghi nhận.',
    ...kq,
  }
}

/** Xoá MỘT tài liệu (file gốc + số liệu). Phải gửi xac_nhan đúng bằng tên file — không hoàn tác được. */
export async function xoaTaiLieu(n: NguCanhMay, a: { nhom: km.NhomTaiLieu; id: string; xac_nhan: string; mst?: string }) {
  const mst = chonMst(n.du.kho, a.mst)
  const tim: { tenFile: string; duongDan?: string } | undefined =
    a.nhom === 'toKhai' ? n.may.toKhai.find((t) => t.mst === mst && t.id === a.id)
    : a.nhom === 'chungTu' ? n.may.chungTu.find((c) => c.mst === mst && c.id === a.id)
    : a.nhom === 'tepHoaDon' ? (n.may.tepHoaDon[mst] ?? []).filter((d) => d.id === a.id).map((d) => ({ tenFile: d.ten, duongDan: d.duongDan }))[0]
    : (n.may.daXuat[mst] ?? []).find((d) => d.id === a.id)
  if (!tim) throw new LoiNguoiDung(`Không có tài liệu ${a.nhom}/${a.id} của công ty ${mst} — xem danh_sach_tai_lieu.`)
  if (a.xac_nhan !== tim.tenFile) {
    return { daXoa: false, lyDo: `Chưa xoá. Để xác nhận, gửi lại với xac_nhan đúng bằng tên file: "${tim.tenFile}" — và chỉ làm vậy khi người dùng đã đồng ý xoá file này.` }
  }
  await km.xoaTaiLieu(n.fb, mst, a.nhom, a.id, tim.duongDan)
  await nhatKy(n, 'xoa_tai_lieu', `XOÁ ${a.nhom}: ${tim.tenFile} (${a.id})`)
  return { daXoa: true, nhom: a.nhom, tenFile: tim.tenFile }
}
