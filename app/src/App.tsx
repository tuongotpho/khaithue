import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { conHieuLuc, docTep, gopHoaDon, kiemSoHoaDonBan, phanLoai, type TepHoaDon } from './core/excel'
import { kiemDauKy, tinhGTGT, NHAP_TAY_TRONG, type NhapTayGTGT, type SuaPhuLucMua } from './core/gtgt'
import { tinhTNCN, NHAP_TNCN_TRONG, type NhapTNCN } from './core/tncn'
import { docToKhai } from './core/docToKhai'
import { tenFileXML, xmlGTGT, xmlTNCN } from './core/xml'
import { denNgay, hanNop, ngayISO, quyCanKhai, tuNgay } from './core/ky'
import { dauKy, datKhongChapNhan, ghiAppXuat, gopTuMay, kyTruoc, napHoaDon, napTaiLieu, napToKhai, rutGonHoaDon, suaHoSo, tncnGanNhat, type Kho } from './core/kho'
import { docTaiLieu } from './core/taiLieu'
import { tinhDoiTac, tinhTongQuan } from './core/tongQuan'
import { NapHangLoat, TongQuanDN } from './ui/TongQuan'
import type { ToKhaiDaNop } from './core/docToKhai'
import { coMay } from './may/firebase'
import { dangNhap, dangXuat, useNguoiDung } from './may/useMay'
import { datCoTraVe, luuChungTu, luuCongTy, luuDaXuat, luuTepHoaDon, luuToKhai, taiDuLieuMay, taiTep, type DuLieuMay } from './may/dongBo'
import { KhoHoSo } from './ui/KhoHoSo'
import { NHAN_GTGT, NHAN_TNCN, tien } from './core/nhan'
import type { CanhBao, HoSoDN, KyKeKhai, LoaiHD } from './core/types'
import { docKho, luuKho, xoaKhoCua, xoaKhoKhach } from './luuTru'
import { Buoc, DanhSachCanhBao, OTien, taiFile, VungThaFile } from './ui/chung'
import { FormHoSo } from './ui/FormHoSo'
import { BangHoaDon, khoaHD } from './ui/BangHoaDon'
import { DanhSachTep, type NhatKy } from './ui/DanhSachTep'
import { SoTheoDoi } from './ui/SoTheoDoi'
import { KetLuanGTGT, PhuLuc, TheTong } from './ui/ToKhaiGTGT'

const THIEU_CQT = (h: HoSoDN) => !h.maCQTNoiNop || !h.tenCQTNoiNop || !h.nguoiKy || !h.maTinhNNT

/** Quý có nhiều hoá đơn nhất trong các file vừa nạp */
function quyNhieuNhat(ds: { ngay: string }[]): KyKeKhai | null {
  const dem = new Map<string, number>()
  for (const h of ds) {
    const m = /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(h.ngay)
    if (m) {
      const k = `${m[2]}-${Math.ceil(Number(m[1]) / 3)}`
      dem.set(k, (dem.get(k) ?? 0) + 1)
    }
  }
  const top = [...dem.entries()].sort((a, b) => b[1] - a[1])[0]
  if (!top) return null
  const [nam, quy] = top[0].split('-').map(Number)
  return { nam, quy: quy as 1 | 2 | 3 | 4 }
}

export default function App() {
  const { user, loi: loiDangNhap } = useNguoiDung()
  // Ngăn lưu trên máy: chưa đăng nhập = ngăn khách; đăng nhập = ngăn riêng của tài khoản
  const chuRef = useRef<string | null>(null)
  const [kho, setKhoState] = useState<Kho>(() => docKho(null))
  const setKho = (k: Kho) => {
    setKhoState(k)
    luuKho(k, chuRef.current)
  }
  /** Cập nhật sổ dựa trên bản mới nhất (dùng khi chạy nền như đồng bộ mây) */
  const capNhatKho = (fn: (k: Kho) => Kho) =>
    setKhoState((cu) => {
      const k = fn(cu)
      luuKho(k, chuRef.current)
      return k
    })

  // ---- Mây (Firebase): đăng nhập Google thì hồ sơ được lưu lên mây ----
  const [may, setMay] = useState<DuLieuMay | null>(null)
  const [trangThaiMay, setTrangThaiMay] = useState('')
  /** Công ty khai lúc CHƯA đăng nhập trên máy này — chỉ đưa vào tài khoản khi người dùng đồng ý */
  const [congTyKhach, setCongTyKhach] = useState(0)
  async function lamMoiMay(uid: string) {
    const du = await taiDuLieuMay(uid)
    setMay(du)
    capNhatKho((k) =>
      gopTuMay(k, du.congTy, du.toKhai, du.chungTu, Object.entries(du.tepHoaDon).flatMap(([mst, ds]) => ds.map((d) => ({ mst, hd: d.hd ?? [] })))),
    )
    return du
  }
  useEffect(() => {
    const chu = user?.uid ?? null
    if (chuRef.current === chu) return
    // Đổi người dùng: dọn sạch màn hình, mở đúng ngăn của người này
    chuRef.current = chu
    xoaHoaDon()
    setMay(null)
    setKhoState(docKho(chu))
    if (!chu) {
      setTrangThaiMay('')
      setCongTyKhach(0)
      return
    }
    setCongTyKhach(Object.keys(docKho(null).congTy).length)
    setTrangThaiMay('Đang tải hồ sơ trên mây…')
    lamMoiMay(chu)
      .then(() => setTrangThaiMay(''))
      .catch((e) => setTrangThaiMay(`⚠️ Không tải được hồ sơ trên mây: ${(e as Error).message}`))
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Người dùng đồng ý: đưa các công ty khai lúc chưa đăng nhập vào tài khoản này */
  async function duaKhachVaoTaiKhoan() {
    if (!user) return
    const khach = docKho(null)
    const ds = Object.values(khach.congTy)
    try {
      await Promise.all(ds.map((c) => luuCongTy(user.uid, c)))
      capNhatKho((k) => {
        const moi = structuredClone(k)
        for (const c of ds) moi.congTy[c.hoSo.mst] ??= c
        for (const [mst, theoKy] of Object.entries(khach.gtgt)) moi.gtgt[mst] = { ...theoKy, ...(moi.gtgt[mst] ?? {}) }
        for (const [mst, theoKy] of Object.entries(khach.tncn)) moi.tncn[mst] = { ...theoKy, ...(moi.tncn[mst] ?? {}) }
        moi.chon ??= khach.chon
        return moi
      })
      xoaKhoKhach()
      setCongTyKhach(0)
      await lamMoiMay(user.uid)
      setTrangThaiMay(`☁️ Đã đưa ${ds.length} công ty vào tài khoản. Kéo lại các file XML cũ để lưu cả tờ khai lên mây.`)
    } catch (e) {
      setTrangThaiMay(`⚠️ ${(e as Error).message}`)
    }
  }

  const [suaHoSoMo, setSuaHoSoMo] = useState(false)
  const [themCongTy, setThemCongTy] = useState(false)
  const [ky, setKyState] = useState<KyKeKhai>(() => quyCanKhai())
  const [kyTay, setKyTay] = useState(false)
  const setKy = (k: KyKeKhai) => {
    setKyState(k)
    setKyTay(true)
  }
  const [teps, setTeps] = useState<TepHoaDon[]>([])
  const [epBuoc, setEpBuoc] = useState<Record<string, LoaiHD>>({})
  const [nhatKy, setNhatKy] = useState<NhatKy[]>([])
  const [chon, setChon] = useState<Record<string, boolean>>({})
  const [nhap, setNhap] = useState<NhapTayGTGT>(NHAP_TAY_TRONG)
  const [ct22Tay, setCt22Tay] = useState<number | null>(null)
  const [suaMua, setSuaMua] = useState<SuaPhuLucMua>({})
  const [coTNCN, setCoTNCN] = useState(false) // 05/KK-TNCN mặc định tắt, quý nào có khai thì bật
  const [nhapTNCN, setNhapTNCN] = useState<NhapTNCN>(NHAP_TNCN_TRONG)
  const [ngayLap, setNgayLap] = useState(ngayISO())
  const [hienItDung, setHienItDung] = useState(false)
  const [daXuat, setDaXuat] = useState(false)
  const [tab, setTab] = useState<'tongQuan' | 'keKhai' | 'kho'>(() => (Object.keys(docKho(null).gtgt).length ? 'tongQuan' : 'keKhai'))
  const [tienDo, setTienDo] = useState<{ xong: number; tong: number; dangLam: string } | null>(null)
  const [ketQuaNap, setKetQuaNap] = useState('')

  const mst = kho.chon
  const congTy = mst ? kho.congTy[mst] : undefined
  const hoSo = congTy?.hoSo ?? null

  // ---- Tự nhận diện hoá đơn ----
  const plTuDo = useMemo(() => phanLoai(teps, null, epBuoc), [teps, epBuoc]) // không biết trước công ty
  const pl = useMemo(() => (mst ? phanLoai(teps, mst, epBuoc) : plTuDo), [teps, mst, epBuoc, plTuDo])
  const congTyTrongHoaDon = plTuDo.mst
  const hoaDonCuaCongTyKhac = !!(mst && congTyTrongHoaDon && congTyTrongHoaDon !== mst && pl.hoaDon.length === 0)

  // Chưa có công ty nào: tạo hồ sơ tạm từ chính hoá đơn (tên, địa chỉ); thiếu phần cơ quan thuế thì nhắc
  useEffect(() => {
    if (mst || !congTyTrongHoaDon) return
    const tam: HoSoDN = {
      mst: congTyTrongHoaDon, tenNNT: plTuDo.tenCongTy, dchiNNT: plTuDo.dchiCongTy, phuongXa: '', maXaNNT: '', maTinhNNT: '', tenTinhNNT: '',
      dthoaiNNT: '', emailNNT: '', maCQTNoiNop: '', tenCQTNoiNop: '', nguoiKy: '',
    }
    setKho({ ...kho, chon: tam.mst, congTy: { ...kho.congTy, [tam.mst]: { hoSo: tam, kyNguon: '', suaTay: false } } })
  }, [congTyTrongHoaDon]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tự chọn quý theo ngày hoá đơn (nếu người dùng chưa tự chọn)
  useEffect(() => {
    if (kyTay) return
    const q = quyNhieuNhat(pl.hoaDon.filter(conHieuLuc))
    if (q) setKyState(q)
  }, [pl, kyTay])

  // Đổi công ty / đổi quý: điền sẵn TNCN theo quý gần nhất đã nạp, xoá [22] gõ tay
  useEffect(() => {
    setCt22Tay(null)
    setDaXuat(false)
    if (!mst) return
    const t = tncnGanNhat(kho, mst, ky)
    if (t) setNhapTNCN(Object.fromEntries(Object.keys(NHAP_TNCN_TRONG).map((k) => [k, t[k] ?? 0])) as unknown as NhapTNCN)
  }, [mst, ky.quy, ky.nam]) // eslint-disable-line react-hooks/exhaustive-deps

  async function nhanFile(ds: File[], taiLen = true) {
    let k = kho
    const xmlLen: { tk: ToKhaiDaNop; text: string; ten: string }[] = []
    const excelLen: { ten: string; du: ArrayBuffer; teps: TepHoaDon[] }[] = []
    const nk: NhatKy[] = []
    const tepMoi: TepHoaDon[] = []
    for (const f of ds) {
      try {
        if (/\.xml$/i.test(f.name)) {
          const text = await f.text()
          const tk = docToKhai(text)
          const kq = napToKhai(k, tk, f.name)
          k = kq.kho
          nk.push({ ten: f.name, moTa: kq.moTa, loi: kq.loi })
          if (!kq.loi) xmlLen.push({ tk, text, ten: f.name })
          continue
        }
        // CSV đọc dạng chữ để giữ đúng tiếng Việt và không bị đổi ngày kiểu Mỹ; Excel đọc nhị phân
        const du = await f.arrayBuffer()
        const wb = /\.csv$/i.test(f.name) ? XLSX.read(new TextDecoder().decode(du), { type: 'string', raw: true }) : XLSX.read(du)
        let co = 0
        const tepCuaFile: TepHoaDon[] = []
        for (const sh of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sh], { header: 1, raw: true, defval: null })
          const t = docTep(rows as never, wb.SheetNames.length > 1 ? `${f.name}#${sh}` : f.name)
          if (t && t.hoaDon.length) {
            tepMoi.push(t)
            tepCuaFile.push(t)
            co++
          }
        }
        if (co) excelLen.push({ ten: f.name, du, teps: tepCuaFile })
        if (!co) nk.push({ ten: f.name, moTa: 'Không phải file "Danh sách hóa đơn" — bỏ qua', loi: true })
      } catch (e) {
        nk.push({ ten: f.name, moTa: `Không đọc được: ${(e as Error).message}`, loi: true })
      }
    }
    if (k !== kho) setKho(k)
    setNhatKy((x) => [...x, ...nk])
    setTeps((x) => [...x.filter((t) => !tepMoi.some((m) => m.ten === t.ten)), ...tepMoi])
    setDaXuat(false)
    if (user && taiLen && (xmlLen.length || excelLen.length)) void taiLenMay(user.uid, k, xmlLen, excelLen, [...teps, ...tepMoi])
  }

  async function taiLenMay(
    uid: string,
    k: Kho,
    xmlLen: { tk: ToKhaiDaNop; text: string; ten: string }[],
    excelLen: { ten: string; du: ArrayBuffer; teps: TepHoaDon[] }[],
    tatCaTep: TepHoaDon[],
  ) {
    setTrangThaiMay(`Đang lưu ${xmlLen.length + excelLen.length} file lên mây…`)
    try {
      // Thông tin công ty phải có trên mây trước
      const mstCanCo = new Set(xmlLen.map((x) => x.tk.hoSo.mst))
      const mstHoaDon = k.chon ?? phanLoai(tatCaTep, null).mst
      if (mstHoaDon && excelLen.length) mstCanCo.add(mstHoaDon)
      await Promise.all([...mstCanCo].filter((m) => k.congTy[m]).map((m) => luuCongTy(uid, k.congTy[m])))
      for (const x of xmlLen) await luuToKhai(uid, x.tk, x.text, x.ten)
      let boQua = 0
      for (const e of excelLen) {
        if (!mstHoaDon || !k.congTy[mstHoaDon]) {
          boQua++
          continue
        }
        const p = phanLoai(e.teps, mstHoaDon)
        const soBan = p.hoaDon.filter((h) => h.loai === 'ban').length
        await luuTepHoaDon(uid, mstHoaDon, e.ten, e.du, quyNhieuNhat(p.hoaDon), soBan, p.hoaDon.length - soBan)
      }
      await lamMoiMay(uid)
      setTrangThaiMay(`☁️ Đã lưu ${xmlLen.length + excelLen.length - boQua} file lên mây.${boQua ? ` ${boQua} file hoá đơn chưa lưu vì chưa rõ công ty — nạp tờ khai XML của công ty rồi kéo lại.` : ''}`)
    } catch (e) {
      setTrangThaiMay(`⚠️ Chưa lưu được lên mây: ${(e as Error).message}`)
    }
  }

  /** Mở lại một quý từ kho trên mây: nạp lại các file Excel hoá đơn đã lưu */
  function moLaiQuy(khoa: string, tep: { ten: string; du: ArrayBuffer }[]) {
    setTab('keKhai')
    xoaHoaDon()
    const m = /^(\d{4})-Q(\d)$/.exec(khoa)
    if (m) {
      setKyState({ nam: Number(m[1]), quy: Number(m[2]) as 1 | 2 | 3 | 4 })
      setKyTay(true)
    }
    void nhanFile(tep.map((t) => new File([t.du], t.ten)), false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /**
   * Nạp HÀNG LOẠT toàn bộ hồ sơ (tờ khai mọi mẫu, chứng từ, hoá đơn XML, Excel hoá đơn) vào sổ;
   * đã đăng nhập thì lưu cả file gốc lên mây. Không đụng tới phần "Kê khai quý" đang làm dở.
   */
  async function napHangLoat(ds: File[]) {
    const xml = ds.filter((f) => /\.xml$/i.test(f.name))
    const excel = ds.filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name))
    const tong = xml.length + excel.length
    let k = kho
    let xong = 0
    const dem = { toKhai: 0, chungTu: 0, hoaDon: 0, excel: 0, boQua: 0, loiMay: 0 }
    const uid = user?.uid
    const viec: (() => Promise<unknown>)[] = []
    const buoc = (ten: string) => setTienDo({ xong: ++xong, tong, dangLam: ten })
    setKetQuaNap('')
    setTienDo({ xong: 0, tong, dangLam: 'bắt đầu…' })

    // 1) XML trước: biết được công ty, sổ tờ khai, chứng từ
    for (const f of xml) {
      buoc(f.name)
      try {
        const text = await f.text()
        const tl = docTaiLieu(text)
        const r = napTaiLieu(k, tl, f.name)
        if (r.loi) {
          dem.boQua++
          continue
        }
        k = r.kho
        if (tl.loai === 'toKhai') dem.toKhai++
        if (tl.loai === 'chungTu') dem.chungTu++
        if (tl.loai === 'hoaDon') dem.hoaDon++
        if (uid) {
          if (tl.loai === 'toKhai') viec.push(() => luuToKhai(uid, tl.tk, text, f.name, { tenTKhai: tl.tenTKhai, kyChu: tl.kyChu }))
          if (tl.loai === 'chungTu') viec.push(() => luuChungTu(uid, tl.ct, text, f.name))
          if (tl.loai === 'hoaDon') {
            const mstCty = k.congTy[tl.hd.mstBan] ? tl.hd.mstBan : tl.hd.mstMua
            const loai = mstCty === tl.hd.mstBan ? 'ban' : 'mua'
            const du = new TextEncoder().encode(text).buffer as ArrayBuffer
            const kyHD = quyNhieuNhat([tl.hd])
            viec.push(() => luuTepHoaDon(uid, mstCty, f.name, du, kyHD, loai === 'ban' ? 1 : 0, loai === 'mua' ? 1 : 0, rutGonHoaDon([{ ...tl.hd, loai }])))
          }
        }
      } catch {
        dem.boQua++
      }
    }

    // 2) Excel hoá đơn: tự nhận công ty + bán/mua, gộp vào sổ hoá đơn rút gọn
    for (const f of excel) {
      buoc(f.name)
      try {
        const du = await f.arrayBuffer()
        const wb = /\.csv$/i.test(f.name) ? XLSX.read(new TextDecoder().decode(du), { type: 'string', raw: true }) : XLSX.read(du)
        const ts = wb.SheetNames.map((sh) => docTep(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sh], { header: 1, raw: true, defval: null }) as never, f.name)).filter((t): t is TepHoaDon => !!t && t.hoaDon.length > 0)
        if (!ts.length) {
          dem.boQua++
          continue
        }
        const mstCty = k.chon && phanLoai(ts, k.chon).hoaDon.length ? k.chon : phanLoai(ts, null).mst
        if (!mstCty) {
          dem.boQua++
          continue
        }
        const p = phanLoai(ts, mstCty)
        k = napHoaDon(k, mstCty, p.hoaDon)
        dem.excel++
        if (uid && k.congTy[mstCty]) {
          const soBan = p.hoaDon.filter((h) => h.loai === 'ban').length
          viec.push(() => luuTepHoaDon(uid, mstCty, f.name, du, quyNhieuNhat(p.hoaDon), soBan, p.hoaDon.length - soBan, rutGonHoaDon(p.hoaDon)))
        }
      } catch {
        dem.boQua++
      }
    }
    setKho(k)

    // 3) Lưu lên mây: thông tin công ty trước, rồi các file (4 file một lúc)
    if (uid && viec.length) {
      await Promise.all(Object.values(k.congTy).map((c) => luuCongTy(uid, c).catch(() => dem.loiMay++)))
      let daLuu = 0
      const chay = async () => {
        while (viec.length) {
          const v = viec.shift()!
          await v().catch(() => dem.loiMay++)
          setTienDo({ xong: ++daLuu, tong: daLuu + viec.length, dangLam: 'lưu lên mây…' })
        }
      }
      await Promise.all([chay(), chay(), chay(), chay()])
      await lamMoiMay(uid).catch(() => dem.loiMay++)
    }
    setTienDo(null)
    setKetQuaNap(
      `Đã nạp ${dem.toKhai} tờ khai, ${dem.chungTu} chứng từ, ${dem.hoaDon} hoá đơn XML, ${dem.excel} file Excel.` +
        (dem.boQua ? ` Bỏ qua ${dem.boQua} file không đọc được.` : '') +
        (uid ? (dem.loiMay ? ` ⚠️ ${dem.loiMay} file chưa lưu được lên mây — nạp lại sau.` : ' ☁️ Đã lưu hết lên mây.') : ' (Chưa đăng nhập: chỉ lưu trên máy này.)'),
    )
  }

  /** Từ bảng tổng quan bấm "Kê khai" một quý: chuyển sang tab kê khai đúng quý đó */
  function moQuyKeKhai(khoa: string) {
    const coFile = (may && mst ? may.tepHoaDon[mst] ?? [] : []).filter((h) => h.ky === khoa && /\.(xlsx|xls|csv)$/i.test(h.ten))
    setTab('keKhai')
    if (coFile.length && user) {
      void Promise.all(coFile.map(async (h) => ({ ten: h.ten, du: await taiTep(h.duongDan) }))).then((tep) => moLaiQuy(khoa, tep))
        .catch((e) => setTrangThaiMay(`⚠️ Không tải được file hoá đơn quý này từ mây: ${(e as Error).message}`))
    } else {
      const m = /^(\d{4})-Q(\d)$/.exec(khoa)
      if (m) {
        xoaHoaDon()
        setKyState({ nam: Number(m[1]), quy: Number(m[2]) as 1 | 2 | 3 | 4 })
        setKyTay(true)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function luuHoSoTay(h: HoSoDN) {
    const k = suaHoSo(kho, h)
    setKho(k)
    if (user) luuCongTy(user.uid, k.congTy[h.mst]).then(() => lamMoiMay(user.uid)).catch((e) => setTrangThaiMay(`⚠️ ${(e as Error).message}`))
  }

  function datTraVe(mstCty: string, khoa: string, i: number, gt: boolean) {
    const ids = kho.gtgt[mstCty]?.[khoa]?.[i]?.ids ?? []
    setKho(datKhongChapNhan(kho, mstCty, khoa, i, gt))
    if (user && ids.length) datCoTraVe(user.uid, mstCty, ids, gt).then(() => lamMoiMay(user.uid)).catch((e) => setTrangThaiMay(`⚠️ ${(e as Error).message}`))
  }

  function xoaHoaDon() {
    setTeps([])
    setNhatKy([])
    setEpBuoc({})
    setChon({})
    setSuaMua({})
    setKyTay(false)
    setDaXuat(false)
  }

  // ---- Tính tờ khai ----
  const gop = useMemo(() => gopHoaDon(pl.hoaDon, ky), [pl, ky])
  const duocTinh = (h: (typeof gop.ban)[number], macDinh: boolean) => chon[khoaHD(h)] ?? macDinh
  const banTinh = [...gop.ban.filter((h) => duocTinh(h, true)), ...gop.ngoaiKy.filter((h) => h.loai === 'ban' && duocTinh(h, false))]
  const muaTinh = [...gop.mua.filter((h) => duocTinh(h, true)), ...gop.ngoaiKy.filter((h) => h.loai === 'mua' && duocTinh(h, false))]

  const dk = mst ? dauKy(kho, mst, ky) : { ct22: null, ghiChu: '', xungDot: false, chenhBoSung: 0 }
  const ct22 = ct22Tay ?? dk.ct22 ?? 0
  const gtgt = tinhGTGT(banTinh, muaTinh, { ...nhap, ct22 }, suaMua)
  const qt = kyTruoc(ky)
  gtgt.canhBao.unshift(
    ...(dk.xungDot ? [{ muc: 'loi' as const, noiDung: dk.ghiChu }] : []),
    ...kiemDauKy(ct22, dk.ct22, `${qt.quy}/${qt.nam}`, dk.chenhBoSung),
    ...kiemSoHoaDonBan(banTinh),
  )
  const tncn = tinhTNCN(nhapTNCN)
  const tq = useMemo(() => (mst ? tinhTongQuan(kho, mst) : null), [kho, mst])
  const layDoiTac = useCallback((nam: number | null) => tinhDoiTac(kho, mst ?? '', nam), [kho, mst])
  const ct = gtgt.toKhai.ct

  const canhBaoHoSo: CanhBao[] = hoSo && THIEU_CQT(hoSo)
    ? [{ muc: 'loi', noiDung: 'Thiếu thông tin cơ quan thuế / người ký. Kéo một file XML tờ khai đã nộp của công ty này vào bước 1, hoặc bấm “Sửa thông tin”.' }]
    : []
  const coLoi = !hoSo || canhBaoHoSo.length > 0 || [...gtgt.canhBao, ...(coTNCN ? tncn.canhBao : [])].some((c) => c.muc === 'loi')

  function xuat(loai: 'gtgt' | 'tncn') {
    if (!hoSo || !mst) return
    const ten = tenFileXML(loai, ky, hoSo.mst)
    const xml = loai === 'gtgt' ? xmlGTGT(gtgt.toKhai, ky, hoSo, ngayLap) : xmlTNCN(tncn.ct, ky, hoSo, ngayLap)
    taiFile(ten, xml)
    if (loai === 'gtgt') setKho(ghiAppXuat(kho, mst, ky, ct))
    setDaXuat(true)
    if (user) {
      luuDaXuat(user.uid, mst, ky, loai, ten, xml, loai === 'gtgt' ? ct.ct40 : null)
        .then(() => lamMoiMay(user.uid))
        .catch((e) => setTrangThaiMay(`⚠️ Chưa lưu được file xuất lên mây: ${(e as Error).message}`))
    }
  }

  const namNay = new Date().getFullYear()
  const dsCongTy = Object.values(kho.congTy)

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="bg-emerald-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-2xl font-bold">Kê khai thuế quý</h1>
          <p className="text-emerald-100">01/GTGT (kèm phụ lục giảm thuế) và 05/KK-TNCN — xuất XML để nộp trên thuedientu.gdt.gov.vn</p>
          {coMay && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {user ? (
                <>
                  <span>☁️ Đang lưu hồ sơ vào tài khoản <b>{user.email ?? 'Google'}</b></span>
                  <button
                    className="underline"
                    onClick={() => {
                      // Máy dùng chung: đăng xuất thì xoá bản sao trên máy (hồ sơ vẫn còn trên mây)
                      xoaKhoCua(user.uid)
                      void dangXuat()
                    }}
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <button
                  className="rounded-lg bg-white px-3 py-1 font-medium text-emerald-800"
                  onClick={() => dangNhap().catch((e) => setTrangThaiMay(`⚠️ Đăng nhập không được: ${(e as Error).message}`))}
                >
                  Đăng nhập Google để lưu hồ sơ lên mây
                </button>
              )}
              {(loiDangNhap || trangThaiMay) && <span className="rounded bg-emerald-800 px-2 py-0.5">{loiDangNhap || trangThaiMay}</span>}
              {user && congTyKhach > 0 && (
                <span className="flex flex-wrap items-center gap-2 rounded bg-amber-100 px-2 py-1 text-amber-900">
                  Trên máy này có {congTyKhach} công ty khai lúc chưa đăng nhập.
                  <button className="font-medium underline" onClick={() => void duaKhachVaoTaiKhoan()}>Đưa vào tài khoản này</button>
                  <button className="underline" onClick={() => setCongTyKhach(0)}>Không</button>
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <nav className="flex flex-wrap gap-2">
          {([['tongQuan', '📊 Tổng quan'], ['keKhai', '📝 Kê khai quý'], ['kho', '🗂 Kho hồ sơ']] as const).map(([k, ten]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 font-medium ${tab === k ? 'bg-emerald-700 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
              {ten}
            </button>
          ))}
          {Object.keys(kho.congTy).length > 1 && (
            <select className="ml-auto rounded-lg border border-slate-300 px-2 py-1" value={mst ?? ''} onChange={(e) => setKho({ ...kho, chon: e.target.value })}>
              {Object.values(kho.congTy).map((c) => <option key={c.hoSo.mst} value={c.hoSo.mst}>{c.hoSo.tenNNT || c.hoSo.mst}</option>)}
            </select>
          )}
        </nav>

        {tab === 'tongQuan' && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-xl font-semibold">{hoSo ? hoSo.tenNNT : 'Tổng quan doanh nghiệp'} {hoSo && <span className="text-base font-normal text-slate-500">— MST {hoSo.mst}</span>}</h2>
            <NapHangLoat onFiles={(f) => void napHangLoat(f)} tienDo={tienDo} />
            {ketQuaNap && <p className="text-sm text-emerald-800">{ketQuaNap}</p>}
            {!user && coMay && <p className="text-sm text-slate-500">Mẹo: đăng nhập Google (trên cùng) trước khi nạp để hồ sơ được lưu lên mây, mở ở máy khác cũng thấy.</p>}
            {tq && hoSo ? <TongQuanDN tq={tq} tenCty={hoSo.tenNNT} onMoQuy={moQuyKeKhai} layDoiTac={layDoiTac} /> : <p className="text-slate-500">Nạp hồ sơ để xem tổng quan.</p>}
          </section>
        )}

        {tab === 'kho' && (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-xl font-semibold">
              🗂 Kho hồ sơ {hoSo && <span className="text-base font-normal text-slate-500">— {hoSo.tenNNT} (MST {hoSo.mst})</span>}
            </h2>
            {!hoSo ? (
              <p className="text-slate-500">Chưa có công ty. Nạp hồ sơ ở tab 📊 Tổng quan.</p>
            ) : (
              <>
                <div>
                  <h3 className="mb-1 font-semibold">Sổ theo dõi tờ khai 01/GTGT (kiểm đầu kỳ – cuối kỳ)</h3>
                  <SoTheoDoi kho={kho} mst={hoSo.mst} onKhongChapNhan={(khoa, i, gt) => datTraVe(hoSo.mst, khoa, i, gt)} />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold">☁️ File đã lưu trên mây, theo quý</h3>
                  {user && may && mst ? (
                    <KhoHoSo may={may} mst={mst} onMoLai={moLaiQuy} />
                  ) : (
                    <p className="text-sm text-slate-500">{coMay ? 'Đăng nhập Google (trên cùng) để xem và tải lại file đã lưu trên mây.' : 'Mở bản web để dùng kho trên mây.'}</p>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {tab === 'keKhai' && (<>
        {/* 1. Nạp file */}
        <Buoc so={1} tieuDe="Kéo file vào" phai={(teps.length > 0 || nhatKy.length > 0) && <button className="text-red-600 underline" onClick={xoaHoaDon}>Làm quý khác</button>}>
          <VungThaFile
            accept=".xlsx,.xls,.csv,.xml"
            onFiles={nhanFile}
            nhan={
              <div className="space-y-1">
                <div className="text-lg font-medium">Kéo thả TẤT CẢ file vào đây (hoặc bấm để chọn)</div>
                <div className="text-slate-600"><b>Tờ khai XML đã nộp</b> các quý trước → app tự lấy thông tin công ty, số [22], số liệu TNCN.</div>
                <div className="text-slate-600"><b>Excel “DANH SÁCH HÓA ĐƠN”</b> của quý cần khai → app tự nhận hoá đơn nào bán ra, hoá đơn nào mua vào.</div>
              </div>
            }
          />
          <DanhSachTep nhatKy={nhatKy} pl={pl} epBuoc={epBuoc} setEpBuoc={setEpBuoc} tenExcel={teps.map((t) => t.ten)} />
          {hoaDonCuaCongTyKhac && kho.congTy[congTyTrongHoaDon!] && (
            <button className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-amber-900" onClick={() => setKho({ ...kho, chon: congTyTrongHoaDon })}>
              Hoá đơn này của {kho.congTy[congTyTrongHoaDon!].hoSo.tenNNT} — bấm để chuyển sang công ty đó
            </button>
          )}
          <DanhSachCanhBao ds={pl.canhBao} />
        </Buoc>

        {/* 2. Doanh nghiệp */}
        <Buoc
          so={2}
          tieuDe="Doanh nghiệp"
          phai={
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {dsCongTy.length > 1 && (
                <select className="rounded-lg border border-slate-300 px-2 py-1" value={mst ?? ''} onChange={(e) => setKho({ ...kho, chon: e.target.value })}>
                  {dsCongTy.map((c) => <option key={c.hoSo.mst} value={c.hoSo.mst}>{c.hoSo.tenNNT || c.hoSo.mst}</option>)}
                </select>
              )}
              {hoSo && !suaHoSoMo && <button className="text-emerald-700 underline" onClick={() => setSuaHoSoMo(true)}>Sửa thông tin</button>}
              <button className="text-emerald-700 underline" onClick={() => setThemCongTy(!themCongTy)}>+ Công ty khác</button>
            </div>
          }
        >
          {themCongTy && (
            <div className="mb-4 rounded-xl bg-slate-50 p-3">
              <p className="mb-2 text-sm text-slate-600">Khai hộ công ty khác: kéo file XML tờ khai của công ty đó vào bước 1 (nhanh nhất), hoặc gõ tay:</p>
              <FormHoSo giaTri={null} onLuu={(h) => { luuHoSoTay(h); setThemCongTy(false) }} onHuy={() => setThemCongTy(false)} />
            </div>
          )}
          {!hoSo ? (
            <p className="text-slate-600">Chưa có công ty. Kéo một file <b>tờ khai XML đã nộp</b> (hoặc file Excel hoá đơn) vào bước 1 — app tự điền.</p>
          ) : suaHoSoMo ? (
            <FormHoSo giaTri={hoSo} onLuu={(h) => { luuHoSoTay(h); setSuaHoSoMo(false) }} onHuy={() => setSuaHoSoMo(false)} />
          ) : (
            <>
              <div className="grid gap-1 text-base sm:grid-cols-2">
                <div><b>{hoSo.tenNNT}</b></div>
                <div>MST: <b>{hoSo.mst}</b></div>
                <div className="text-slate-600 sm:col-span-2">{hoSo.dchiNNT}</div>
                <div className="text-slate-600">Nơi nộp: {hoSo.tenCQTNoiNop || '—'} {hoSo.maCQTNoiNop && `(${hoSo.maCQTNoiNop})`}</div>
                <div className="text-slate-600">Người ký: {hoSo.nguoiKy || '—'}</div>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {congTy?.suaTay ? 'Đã sửa tay — tờ khai XML nạp sau chỉ điền thêm ô còn trống.' : congTy?.kyNguon ? `Tự điền từ tờ khai quý ${congTy.kyNguon.replace(/^(\d{4})-Q(\d)$/, '$2/$1')}.` : 'Tạm lấy từ hoá đơn.'}
              </p>
              <DanhSachCanhBao ds={canhBaoHoSo} />
              {dk.xungDot && (
                <p className="mt-2 text-sm text-red-700">
                  ⛔ Quý trước có nhiều bản lần đầu khác số liệu — sang tab{' '}
                  <button className="underline" onClick={() => setTab('kho')}>🗂 Kho hồ sơ</button> đánh dấu bản bị cơ quan thuế trả về.
                </p>
              )}
            </>
          )}
        </Buoc>


        {/* 3. Kỳ */}
        <Buoc so={3} tieuDe="Kỳ kê khai">
          <div className="flex flex-wrap items-center gap-3 text-base">
            <label>Quý
              <select className="ml-2 rounded-lg border border-slate-300 px-2 py-1" value={ky.quy} onChange={(e) => setKy({ ...ky, quy: Number(e.target.value) as 1 | 2 | 3 | 4 })}>
                {[1, 2, 3, 4].map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </label>
            <label>Năm
              <select className="ml-2 rounded-lg border border-slate-300 px-2 py-1" value={ky.nam} onChange={(e) => setKy({ ...ky, nam: Number(e.target.value) })}>
                {[namNay - 2, namNay - 1, namNay, namNay + 1].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="text-slate-600">Từ {tuNgay(ky)} đến {denNgay(ky)}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">Hạn nộp: <b>{hanNop(ky)}</b></span>
            {!kyTay && pl.hoaDon.length > 0 && <span className="text-sm text-slate-500">(tự chọn theo ngày hoá đơn)</span>}
          </div>
        </Buoc>

        {/* 4. Hoá đơn */}
        {pl.hoaDon.length > 0 && (
          <Buoc so={4} tieuDe="Hoá đơn trong quý">
            <div className="grid gap-3 sm:grid-cols-2">
              <TheTong ten="Bán ra" ds={banTinh} />
              <TheTong ten="Mua vào" ds={muaTinh} />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {gop.trung > 0 && <>Bỏ {gop.trung} dòng trùng (cùng hoá đơn có ở nhiều file). </>}
              {gop.boQua.length > 0 && <>Bỏ {gop.boQua.length} hoá đơn đã bị thay thế/huỷ. </>}
              {gop.ngoaiKy.length > 0 && <b className="text-amber-800">Có {gop.ngoaiKy.length} hoá đơn ngoài quý — mặc định KHÔNG tính. </b>}
            </p>
            <BangHoaDon gop={gop} chon={chon} setChon={setChon} />
          </Buoc>
        )}

        {/* 5. 01/GTGT */}
        <Buoc so={5} tieuDe="Tờ khai 01/GTGT">
          <div className="mb-4 rounded-xl bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">[22] Thuế còn được khấu trừ kỳ trước chuyển sang:</span>
              <OTien value={ct22} onChange={(v) => setCt22Tay(v)} />
              {ct22Tay !== null && <button className="text-sm text-emerald-700 underline" onClick={() => setCt22Tay(null)}>Trả về số tự động</button>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {ct22Tay !== null ? 'Đang gõ tay.' : dk.ct22 !== null ? dk.ghiChu : 'Kéo file XML tờ khai lần đầu quý trước vào bước 1 để app tự điền và đối chiếu.'}
            </p>
            <label className="mt-2 flex items-center gap-2">
              <input type="checkbox" checked={nhap.ct21} onChange={(e) => setNhap({ ...nhap, ct21: e.target.checked })} />
              [21] Không phát sinh hoạt động mua, bán trong kỳ
            </label>
            <button className="mt-2 text-sm text-emerald-700 underline" onClick={() => setHienItDung(!hienItDung)}>
              {hienItDung ? 'Ẩn' : 'Hiện'} các chỉ tiêu ít dùng ([23a] [24a] [26] [32a] [37] [38] [39a] [40b] [42])
            </button>
            {hienItDung && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(['ct23a', 'ct24a', 'ct26', 'ct32a', 'ct37', 'ct38', 'ct39a', 'ct40b', 'ct42'] as const).map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2 text-sm">
                    <span>[{k.slice(2)}] {NHAN_GTGT.find((x) => x[0] === k)?.[1]}</span>
                    <OTien value={nhap[k]} onChange={(v) => setNhap({ ...nhap, [k]: v })} />
                  </label>
                ))}
              </div>
            )}
          </div>

          <KetLuanGTGT ct={ct} />
          <DanhSachCanhBao ds={gtgt.canhBao} />

          <div className="overflow-x-auto">
            <table className="mt-4 w-full text-sm">
              <tbody>
                {NHAN_GTGT.map(([k, ten]) => (
                  <tr key={k} className={`border-b border-slate-100 ${['ct40', 'ct43'].includes(k) ? 'font-bold' : ''}`}>
                    <td className="w-14 py-1 text-slate-500">[{k.slice(2)}]</td>
                    <td className="py-1">{ten}</td>
                    <td className="py-1 text-right tabular-nums">{tien(ct[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PhuLuc tk={gtgt.toKhai} suaMua={suaMua} setSuaMua={setSuaMua} />
        </Buoc>

        {/* 6. TNCN */}
        <Buoc
          so={6}
          tieuDe="Tờ khai 05/KK-TNCN"
          phai={<label className="flex items-center gap-2"><input type="checkbox" checked={coTNCN} onChange={(e) => setCoTNCN(e.target.checked)} /> Có khai quý này</label>}
        >
          {coTNCN ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {NHAN_TNCN.map(([k, ten, tay]) => (
                      <tr key={k} className="border-b border-slate-100">
                        <td className="w-16 py-1 text-slate-500">[{k.slice(2).replace('_', '.')}]</td>
                        <td className={`py-1 ${tay ? '' : 'font-medium'}`}>{ten}</td>
                        <td className="py-1 text-right">
                          {tay ? (
                            <OTien value={nhapTNCN[k as keyof NhapTNCN]} onChange={(v) => setNhapTNCN({ ...nhapTNCN, [k]: v })} />
                          ) : (
                            <span className="font-medium tabular-nums">{tien(tncn.ct[k as keyof typeof tncn.ct])}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-sm text-slate-500">Ô tổng ([18] [21] [26] [29]) app tự cộng. Số liệu điền sẵn theo tờ khai TNCN gần nhất đã nạp.</p>
              <DanhSachCanhBao ds={tncn.canhBao} />
            </>
          ) : (
            <p className="text-slate-500">Không xuất tờ khai TNCN cho quý này.</p>
          )}
        </Buoc>

        {/* 7. Xuất */}
        <Buoc so={7} tieuDe="Xuất file XML và nộp">
          <label className="mb-3 flex items-center gap-2">
            Ngày lập tờ khai:
            <input type="date" className="rounded-lg border border-slate-300 px-2 py-1" value={ngayLap} onChange={(e) => setNgayLap(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-3">
            <button disabled={coLoi} onClick={() => xuat('gtgt')} className="rounded-xl bg-emerald-600 px-5 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">⬇ Tải XML 01/GTGT</button>
            {coTNCN && <button disabled={coLoi} onClick={() => xuat('tncn')} className="rounded-xl bg-emerald-600 px-5 py-3 text-lg font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">⬇ Tải XML 05/KK-TNCN</button>}
          </div>
          {coLoi && <p className="mt-2 text-red-700">{!hoSo ? 'Chưa có thông tin doanh nghiệp (bước 1–2).' : 'Còn lỗi ⛔ ở trên — sửa xong mới xuất được.'}</p>}
          {daXuat && <p className="mt-2 text-emerald-700">Đã tải file. Sau khi nộp xong, kéo file XML đã nộp vào bước 1 để sổ theo dõi ghi nhận bản chính thức.</p>}
          <ol className="mt-4 list-decimal space-y-1 pl-6 text-slate-700">
            <li>Vào <b>thuedientu.gdt.gov.vn</b> → đăng nhập doanh nghiệp.</li>
            <li>Chọn <b>Khai thuế → Nộp tờ khai XML</b> → chọn file vừa tải.</li>
            <li>Cổng thuế đọc file và hiện tờ khai. <b>Xem lại các con số</b> có giống bước 5, 6 không.</li>
            <li>Cắm USB chữ ký số → <b>Ký điện tử</b> → <b>Nộp tờ khai</b>.</li>
            <li>Chờ <b>thông báo chấp nhận</b> của cơ quan thuế (email / mục Tra cứu). Bị trả về thì tích “CQT trả về” cho bản đó ở sổ theo dõi.</li>
          </ol>
          <p className="mt-3 text-sm text-slate-500">Nếu cổng thuế báo lỗi file: dùng “Kê khai trực tuyến” và gõ các con số ở bước 5, 6 vào.</p>
        </Buoc>
        </>)}
        <p className="pb-6 text-center text-xs text-slate-400">
          {user ? 'Hồ sơ được lưu vào tài khoản Google đang đăng nhập — chỉ tài khoản này xem được.' : 'Chưa đăng nhập: mọi dữ liệu chỉ xử lý và lưu trên máy này, không gửi đi đâu.'}
        </p>
      </main>
    </div>
  )
}
