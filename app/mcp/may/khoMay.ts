// Đọc / ghi hồ sơ trên mây cho máy chủ MCP — CÙNG đường dẫn, CÙNG tên ô với web app (src/may/dongBo.ts),
// nên thứ AI ghi thì web app thấy ngay và ngược lại. Test liên thông: firebase-tests/mcpMay.test.ts.
//
// Thêm 2 nhánh riêng cho AI (vẫn nằm trong vùng nguoiDung/{uid}, luật phân quyền cũ đã bao):
//   nguoiDung/{uid}/phienAI/{maPhien}   mỗi máy / ứng dụng AI đã được cho phép — xoá = thu hồi
//   nguoiDung/{uid}/nhatKyAI/{ma}       mỗi lần AI ghi / xoá: lúc nào, máy nào, làm gì

import { createHash, randomUUID } from 'node:crypto'
import type { ChungTu } from '../../src/core/taiLieu.js'
import type { ToKhaiDaNop } from '../../src/core/docToKhai.js'
import type { HoaDon, KyKeKhai } from '../../src/core/types.js'
import { gopTuMay, khoaKy, khoTrong, moRongHoaDon, type CongTyLuu, type HoaDonGon, type ToKhaiMay } from '../../src/core/kho.js'
import type { DuLieu } from '../congCu.js'
import type { FirebaseNguoiDung } from './firebaseRest.js'

export const maBam = (du: Uint8Array | string) =>
  createHash('sha256').update(typeof du === 'string' ? Buffer.from(du, 'utf8') : du).digest('hex').slice(0, 32)

const nhanhCongTy = (uid: string, mst: string) => `nguoiDung/${uid}/congTy/${mst}`
const tenAnToan = (ten: string) => ten.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120)
const bayGio = () => new Date()

export type NhomTaiLieu = 'toKhai' | 'tepHoaDon' | 'chungTu' | 'daXuat'
export const CAC_NHOM: NhomTaiLieu[] = ['toKhai', 'tepHoaDon', 'chungTu', 'daXuat']

export interface TepHoaDonMay {
  id: string
  ten: string
  ky: string
  soBan: number
  soMua: number
  kichThuoc: number
  duongDan: string
  hd?: HoaDonGon[]
  phu?: { ban: string[]; mua: string[] }
}
export interface DaXuatMay { id: string; loai: 'gtgt' | 'tncn'; ky: string; tenFile: string; ct40: number | null; duongDan: string }
export type ChungTuMay = ChungTu & { id: string; duongDan: string; tenFile: string }

export interface DuLieuMay {
  congTy: CongTyLuu[]
  toKhai: (ToKhaiMay & { duongDan: string })[]
  tepHoaDon: Record<string, TepHoaDonMay[]>
  daXuat: Record<string, DaXuatMay[]>
  chungTu: ChungTuMay[]
}

export async function taiDuLieuMay(fb: FirebaseNguoiDung): Promise<DuLieuMay> {
  const uid = fb.uid
  const kq: DuLieuMay = { congTy: [], toKhai: [], tepHoaDon: {}, daXuat: {}, chungTu: [] }
  const cts = await fb.docBoSuuTap<CongTyLuu>(`nguoiDung/${uid}/congTy`)
  await Promise.all(cts.map(async (c) => {
    kq.congTy.push({ hoSo: c.hoSo, kyNguon: c.kyNguon ?? '', suaTay: !!c.suaTay })
    const [tk, hd, xu, ct] = await Promise.all([
      fb.docBoSuuTap<Omit<ToKhaiMay, 'id'> & { duongDan: string }>(`${nhanhCongTy(uid, c.id)}/toKhai`),
      fb.docBoSuuTap<Omit<TepHoaDonMay, 'id'>>(`${nhanhCongTy(uid, c.id)}/tepHoaDon`),
      fb.docBoSuuTap<Omit<DaXuatMay, 'id'>>(`${nhanhCongTy(uid, c.id)}/daXuat`),
      fb.docBoSuuTap<Omit<ChungTuMay, 'id'>>(`${nhanhCongTy(uid, c.id)}/chungTu`),
    ])
    kq.toKhai.push(...tk)
    kq.chungTu.push(...ct)
    kq.tepHoaDon[c.id] = hd
    kq.daXuat[c.id] = xu
  }))
  // thứ tự ổn định (các bộ sưu tập về song song)
  kq.congTy.sort((a, b) => a.hoSo.mst.localeCompare(b.hoSo.mst))
  kq.toKhai.sort((a, b) => a.id.localeCompare(b.id))
  return kq
}

/** Dựng sổ từ mây Y HỆT web app (App.lamMoiMay -> gopTuMay) */
export function dungDuLieu(may: DuLieuMay): DuLieu {
  const kho = gopTuMay(khoTrong(), may.congTy, may.toKhai, may.chungTu,
    Object.entries(may.tepHoaDon).flatMap(([mst, ds]) => ds.map((d) => ({ mst, hd: d.hd ?? [], phu: d.phu }))))
  // Hoá đơn đầy đủ để lập tờ khai: lấy từ danh sách Excel (không lấy hoá đơn XML lẻ)
  const hoaDon: Record<string, HoaDon[]> = {}
  for (const [mst, nhom] of Object.entries(kho.hoaDon ?? {})) hoaDon[mst] = Object.values(nhom).filter((g) => !g.x).map((g) => moRongHoaDon(g, mst))
  const tepCu = Object.values(may.tepHoaDon).flat().filter((d) => (!d.hd?.length || !d.phu) && d.soBan + d.soMua > 0 && /\.(xlsx|xls|csv)$/i.test(d.ten))
  const loi = tepCu.length ? [`${tepCu.length} file hoá đơn lưu bằng bản cũ chưa có danh sách hoá đơn rút gọn (${tepCu.map((d) => d.ten).join(', ')}) — mở web app một lần để app tự bổ sung.`] : []
  return {
    kho,
    hoaDon,
    baoCao: {
      nguon: 'mây (Firebase, database khaithue) — đúng dữ liệu web app đang dùng',
      napLuc: new Date().toISOString(),
      soToKhai: may.toKhai.length,
      soTepHoaDon: Object.values(may.tepHoaDon).flat().length,
      soChungTu: may.chungTu.length,
      soFileDaXuat: Object.values(may.daXuat).flat().length,
      loi,
    },
  }
}

// ---------------- GHI (cùng cách web app ghi) ----------------

export async function luuCongTy(fb: FirebaseNguoiDung, c: CongTyLuu) {
  await fb.ghi(nhanhCongTy(fb.uid, c.hoSo.mst), { ...c, capNhat: bayGio() })
}

export async function luuToKhai(fb: FirebaseNguoiDung, tk: ToKhaiDaNop, xml: string, tenFile: string, them: { tenTKhai?: string; kyChu?: string } = {}) {
  const id = maBam(xml)
  const mst = tk.hoSo.mst
  const duongDan = `nguoiDung/${fb.uid}/${mst}/toKhai/${id}.xml`
  await fb.taiLenTep(duongDan, new TextEncoder().encode(xml), 'application/xml')
  // hợp nhất: giữ cờ "CQT trả về" nếu đã đánh dấu trước đó
  await fb.ghi(`${nhanhCongTy(fb.uid, mst)}/toKhai/${id}`, {
    mst, maTKhai: tk.maTKhai, tenTKhai: them.tenTKhai ?? '', ky: them.kyChu ?? (tk.ky ? khoaKy(tk.ky) : ''), loaiTKhai: tk.loaiTKhai, soLan: tk.soLan, ngayLap: tk.ngayLap,
    ct: tk.ct, plMua: tk.plMua.filter((d) => d.ten), plBan: tk.plBan.filter((d) => d.ten), tenFile, duongDan, napLuc: bayGio(),
  }, 'hopNhat')
  return id
}

export async function luuTepHoaDon(
  fb: FirebaseNguoiDung, mst: string, ten: string, du: Uint8Array, ky: KyKeKhai | null, soBan: number, soMua: number,
  hd: HoaDonGon[] = [], phu: { ban: string[]; mua: string[] } = { ban: [], mua: [] },
) {
  const id = maBam(du)
  const duongDan = `nguoiDung/${fb.uid}/${mst}/hoaDon/${id}/${tenAnToan(ten)}`
  await fb.taiLenTep(duongDan, du)
  await fb.ghi(`${nhanhCongTy(fb.uid, mst)}/tepHoaDon/${id}`, { ten, ky: ky ? khoaKy(ky) : '', soBan, soMua, kichThuoc: du.byteLength, duongDan, hd, phu, napLuc: bayGio() })
  return id
}

export async function luuChungTu(fb: FirebaseNguoiDung, ct: ChungTu, xml: string, tenFile: string) {
  const id = maBam(xml)
  const duongDan = `nguoiDung/${fb.uid}/${ct.mst}/chungTu/${id}.xml`
  await fb.taiLenTep(duongDan, new TextEncoder().encode(xml), 'application/xml')
  await fb.ghi(`${nhanhCongTy(fb.uid, ct.mst)}/chungTu/${id}`, { ...ct, duongDan, tenFile, napLuc: bayGio() })
  return id
}

export async function luuDaXuat(fb: FirebaseNguoiDung, mst: string, ky: KyKeKhai, loai: 'gtgt' | 'tncn', tenFile: string, xml: string, ct40: number | null) {
  const duongDan = `nguoiDung/${fb.uid}/${mst}/daXuat/${tenAnToan(tenFile)}`
  await fb.taiLenTep(duongDan, new TextEncoder().encode(xml), 'application/xml')
  await fb.ghi(`${nhanhCongTy(fb.uid, mst)}/daXuat/${tenAnToan(tenFile)}`, { loai, ky: khoaKy(ky), tenFile, ct40, duongDan, luc: bayGio() })
  return duongDan
}

export async function datCoTraVe(fb: FirebaseNguoiDung, mst: string, ids: string[], gt: boolean) {
  await Promise.all(ids.map((id) => fb.ghi(`${nhanhCongTy(fb.uid, mst)}/toKhai/${id}`, { khongChapNhan: gt }, 'capNhat')))
}

/** Xoá 1 tài liệu: file gốc trên Storage + bản ghi số liệu (không hoàn tác được) */
export async function xoaTaiLieu(fb: FirebaseNguoiDung, mst: string, nhom: NhomTaiLieu, id: string, duongDan?: string) {
  if (duongDan) await fb.xoaTep(duongDan)
  await fb.xoa(`${nhanhCongTy(fb.uid, mst)}/${nhom}/${id}`)
}

// ---------------- Phiên AI + nhật ký ----------------

export interface PhienAI {
  tenMay: string
  ungDung: string
  noiNhan: string // máy chủ nhận mã (localhost = Claude Code trên máy; claude.ai ...)
  taoLuc: string
}

export async function taoPhien(fb: FirebaseNguoiDung, p: Omit<PhienAI, 'taoLuc'>): Promise<string> {
  const ma = randomUUID()
  await fb.ghi(`nguoiDung/${fb.uid}/phienAI/${ma}`, { ...p, taoLuc: bayGio() })
  return ma
}

export async function conPhien(fb: FirebaseNguoiDung, ma: string): Promise<PhienAI | null> {
  return fb.docTaiLieu<PhienAI>(`nguoiDung/${fb.uid}/phienAI/${ma}`)
}

export async function ghiNhatKy(fb: FirebaseNguoiDung, maPhien: string, tenMay: string, congCu: string, moTa: string) {
  // mã theo thời gian để xếp được; thêm đuôi ngẫu nhiên để không trùng
  const ma = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  await fb.ghi(`nguoiDung/${fb.uid}/nhatKyAI/${ma}`, { luc: bayGio(), maPhien, tenMay, congCu, moTa })
}
