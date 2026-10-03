// Lưu / đọc hồ sơ thuế trên mây.
//
// Firestore (database "khaithue"):
//   nguoiDung/{uid}/congTy/{mst}                    thông tin công ty
//   nguoiDung/{uid}/congTy/{mst}/toKhai/{maBam}     tờ khai đã nộp (số liệu tóm tắt + đường dẫn file XML)
//   nguoiDung/{uid}/congTy/{mst}/tepHoaDon/{maBam}  file Excel hoá đơn (quý, số HĐ, đường dẫn file)
//   nguoiDung/{uid}/congTy/{mst}/daXuat/{tenFile}   file XML app đã xuất
// Storage (bucket "khaithue"): nguoiDung/{uid}/{mst}/...  -> file gốc
//
// Mã bản ghi = mã băm SHA-256 của nội dung file: nạp lại cùng một file không sinh bản trùng.

import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { getBytes, ref, uploadBytes } from 'firebase/storage'
import { db, luuTru } from './firebase'
import type { CongTyLuu, ToKhaiMay } from '../core/kho'
import type { ToKhaiDaNop } from '../core/docToKhai'
import type { KyKeKhai } from '../core/types'
import { khoaKy } from '../core/kho'

export async function maBam(du: ArrayBuffer | string): Promise<string> {
  const b = typeof du === 'string' ? new TextEncoder().encode(du) : new Uint8Array(du)
  const h = await crypto.subtle.digest('SHA-256', b)
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

const nhanhCongTy = (uid: string, mst: string) => `nguoiDung/${uid}/congTy/${mst}`
/** Tên file an toàn cho đường dẫn Storage */
const tenAnToan = (ten: string) => ten.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120)

export async function luuCongTy(uid: string, c: CongTyLuu) {
  await setDoc(doc(db, nhanhCongTy(uid, c.hoSo.mst)), { ...c, capNhat: serverTimestamp() })
}

/** Lưu tờ khai XML đã nộp: file gốc lên Storage, số liệu lên Firestore. Trả về mã bản ghi. */
export async function luuToKhai(uid: string, tk: ToKhaiDaNop, xml: string, tenFile: string): Promise<string> {
  const id = await maBam(xml)
  const mst = tk.hoSo.mst
  const duongDan = `nguoiDung/${uid}/${mst}/toKhai/${id}.xml`
  await uploadBytes(ref(luuTru, duongDan), new TextEncoder().encode(xml), { contentType: 'application/xml' })
  // merge: giữ nguyên cờ "CQT trả về" nếu đã đánh dấu trước đó
  await setDoc(doc(db, `${nhanhCongTy(uid, mst)}/toKhai/${id}`), {
    mst, maTKhai: tk.maTKhai, ky: tk.ky ? khoaKy(tk.ky) : '', loaiTKhai: tk.loaiTKhai, soLan: tk.soLan, ngayLap: tk.ngayLap,
    ct: tk.ct, tenFile, duongDan, napLuc: serverTimestamp(),
  }, { merge: true })
  return id
}

export interface TepHoaDonMay {
  id: string
  ten: string
  ky: string
  soBan: number
  soMua: number
  kichThuoc: number
  duongDan: string
}

export async function luuTepHoaDon(uid: string, mst: string, ten: string, du: ArrayBuffer, ky: KyKeKhai | null, soBan: number, soMua: number) {
  const id = await maBam(du)
  const duongDan = `nguoiDung/${uid}/${mst}/hoaDon/${id}/${tenAnToan(ten)}`
  await uploadBytes(ref(luuTru, duongDan), new Uint8Array(du))
  const ghi: Omit<TepHoaDonMay, 'id'> = { ten, ky: ky ? khoaKy(ky) : '', soBan, soMua, kichThuoc: du.byteLength, duongDan }
  await setDoc(doc(db, `${nhanhCongTy(uid, mst)}/tepHoaDon/${id}`), { ...ghi, napLuc: serverTimestamp() })
}

export interface DaXuatMay {
  id: string
  loai: 'gtgt' | 'tncn'
  ky: string
  tenFile: string
  ct40: number | null
  duongDan: string
}

export async function luuDaXuat(uid: string, mst: string, ky: KyKeKhai, loai: 'gtgt' | 'tncn', tenFile: string, xml: string, ct40: number | null) {
  const duongDan = `nguoiDung/${uid}/${mst}/daXuat/${tenAnToan(tenFile)}`
  await uploadBytes(ref(luuTru, duongDan), new TextEncoder().encode(xml), { contentType: 'application/xml' })
  await setDoc(doc(db, `${nhanhCongTy(uid, mst)}/daXuat/${tenAnToan(tenFile)}`), { loai, ky: khoaKy(ky), tenFile, ct40, duongDan, luc: serverTimestamp() })
}

export async function datCoTraVe(uid: string, mst: string, ids: string[], gt: boolean) {
  await Promise.all(ids.map((id) => updateDoc(doc(db, `${nhanhCongTy(uid, mst)}/toKhai/${id}`), { khongChapNhan: gt })))
}

export interface DuLieuMay {
  congTy: CongTyLuu[]
  toKhai: (ToKhaiMay & { duongDan: string })[]
  tepHoaDon: Record<string, TepHoaDonMay[]>
  daXuat: Record<string, DaXuatMay[]>
}

/** Tải toàn bộ hồ sơ của tài khoản (chỉ số liệu, chưa tải file) */
export async function taiDuLieuMay(uid: string): Promise<DuLieuMay> {
  const kq: DuLieuMay = { congTy: [], toKhai: [], tepHoaDon: {}, daXuat: {} }
  const cts = await getDocs(collection(db, `nguoiDung/${uid}/congTy`))
  await Promise.all(cts.docs.map(async (d) => {
    const c = d.data() as CongTyLuu
    kq.congTy.push({ hoSo: c.hoSo, kyNguon: c.kyNguon ?? '', suaTay: !!c.suaTay })
    const mst = d.id
    const [tk, hd, xu] = await Promise.all([
      getDocs(collection(db, `${nhanhCongTy(uid, mst)}/toKhai`)),
      getDocs(collection(db, `${nhanhCongTy(uid, mst)}/tepHoaDon`)),
      getDocs(collection(db, `${nhanhCongTy(uid, mst)}/daXuat`)),
    ])
    kq.toKhai.push(...tk.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<ToKhaiMay, 'id'> & { duongDan: string }) })))
    kq.tepHoaDon[mst] = hd.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<TepHoaDonMay, 'id'>) }))
    kq.daXuat[mst] = xu.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<DaXuatMay, 'id'>) }))
  }))
  return kq
}

export async function taiTep(duongDan: string): Promise<ArrayBuffer> {
  return getBytes(ref(luuTru, duongDan))
}
