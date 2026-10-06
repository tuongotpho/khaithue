// Máy chủ MCP trên mạng, đi một vòng THẬT trên máy giả lập Firebase (Auth + Firestore + Storage + luật phân quyền):
//   web app ghi -> AI đọc được;  AI ghi -> web app thấy;  xoá phải xác nhận;  thu hồi phiên trên web app -> AI bị chặn.
// Đăng nhập Google giả (máy giả lập), đi đủ các bước OAuth như Claude Code: đăng ký -> trang đăng nhập -> cho phép -> đổi mã.

import { beforeAll, describe, expect, it } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import * as XLSX from 'xlsx'
import { GoogleAuthProvider, signInWithCredential, signOut } from 'firebase/auth'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { auth } from '../src/may/firebase'
import { luuCongTy, luuToKhai, taiDuLieuMay, taiNhatKyAI, taiPhienAI, taiTep, thuHoiPhienAI } from '../src/may/dongBo'
import { docToKhai } from '../src/core/docToKhai'
import { tinhGTGT } from '../src/core/gtgt'
import { xmlGTGT } from '../src/core/xml'
import type { HoaDon, HoSoDN } from '../src/core/types'
import { taoXuLy } from '../mcp/may/web'

const MST = '0109999999'
const hoSo: HoSoDN = {
  mst: MST, tenNNT: 'Công ty TNHH Thử Nghiệm', dchiNNT: 'Số 1', phuongXa: 'Phường A', maXaNNT: '00001', maTinhNNT: '25',
  tenTinhNNT: 'Phú Thọ', dthoaiNNT: '', emailNNT: '', maCQTNoiNop: '12345', tenCQTNoiNop: 'Thuế cơ sở 1', nguoiKy: 'Nguyễn Văn A',
}
const hd = (o: Partial<HoaDon>): HoaDon => ({
  loai: 'mua', kyHieuMau: '1', kyHieu: 'C26TAA', so: '1', ngay: '15/02/2026', mstBan: '0200000002', tenBan: 'NCC', mstMua: MST, tenMua: hoSo.tenNNT,
  chuaThue: 0, thue: 0, trangThai: 'Hóa đơn mới', file: '', ...o,
})
const GOC = 'http://localhost:8787'
const xuLy = taoXuLy({ KHAITHUE_GIA_LAP: '1', CONG_FIRESTORE_GIA_LAP: process.env.CONG_FIRESTORE_GIA_LAP, KHAITHUE_MCP_KHOA: randomBytes(32).toString('hex'), KHAITHUE_GOC_URL: GOC })
const goi = (duong: string, init: RequestInit = {}) => xuLy(new Request(`${GOC}${duong}`, init))
const REDIRECT = 'http://localhost:5555/callback'

let uid = ''
let maLamMoi = ''

/** Đi đủ các bước OAuth như Claude Code; trả vé truy cập + vé làm mới */
async function ketNoi(tenMay: string) {
  const { client_id } = await (await goi('/oauth/dang-ky', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: 'Claude Code' }) })).json()
  const verifier = randomBytes(32).toString('base64url')
  const q = new URLSearchParams({ response_type: 'code', client_id, redirect_uri: REDIRECT, state: 'st', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })
  const html = await (await goi(`/oauth/dang-nhap?${q}`)).text()
  const yeuCau = JSON.parse(/const yeuCau = ("[^"]+");/.exec(html)![1])
  // (trên trình duyệt: người dùng bấm "Đăng nhập Google và cho phép" -> trang gửi mã làm mới Firebase lên)
  const cp = await (await goi('/oauth/cho-phep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yeuCau, maLamMoi, tenMay }) })).json()
  const ve = new URL(cp.chuyenToi)
  expect(ve.origin + ve.pathname).toBe(REDIRECT)
  expect(ve.searchParams.get('state')).toBe('st')
  const doi = (ver: string) => goi('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: ve.searchParams.get('code')!, code_verifier: ver, redirect_uri: REDIRECT, client_id }).toString() })
  expect((await doi('sai-verifier')).status).toBe(400) // kẻ cướp được mã nhưng không có verifier -> không đổi được
  const r = await doi(verifier)
  expect(r.status).toBe(200)
  return (await r.json()) as { access_token: string; refresh_token: string }
}

async function moClient(ve: string) {
  const c = new Client({ name: 'test', version: '1' })
  await c.connect(new StreamableHTTPClientTransport(new URL(`${GOC}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${ve}` } },
    fetch: (u, init) => xuLy(new Request(u, init)),
  }))
  return c
}
async function goiCC(c: Client, ten: string, args: Record<string, unknown> = {}) {
  const r = await c.callTool({ name: ten, arguments: args })
  return { loi: !!r.isError, kq: JSON.parse((r.content as { text: string }[])[0].text) }
}

beforeAll(async () => {
  await signOut(auth)
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: `mcp-${Date.now()}`, email: 'mcp@thu.vn', email_verified: true })))
  uid = user.uid
  maLamMoi = user.refreshToken
  // WEB APP lưu hồ sơ như bình thường: công ty + tờ khai quý 1 ([43] = 5.000)
  const q1 = xmlGTGT(tinhGTGT([], [hd({ chuaThue: 50000, thue: 5000 })]).toKhai, { quy: 1, nam: 2026 }, hoSo, '2026-04-20')
  await luuCongTy(uid, { hoSo, kyNguon: '2026-Q1', suaTay: false })
  await luuToKhai(uid, docToKhai(q1), q1, `${MST}000-01_GTGT_TT80-Q12026-L00.xml`)
})

describe('Máy chủ MCP trên mạng ↔ dữ liệu thật của web app (máy giả lập)', () => {
  let c: Client
  let ve: { access_token: string; refresh_token: string }

  it('kết nối qua OAuth; web app thấy máy mới trong danh sách phiên', async () => {
    ve = await ketNoi('Máy cơ quan')
    c = await moClient(ve.access_token)
    const ten = (await c.listTools()).tools.map((t) => t.name)
    expect(ten).toEqual(expect.arrayContaining(['tong_quan', 'lap_to_khai_gtgt', 'nap_tai_lieu', 'danh_dau_tra_ve', 'sua_thong_tin_cong_ty', 'luu_xml_gtgt', 'xoa_tai_lieu', 'danh_sach_tai_lieu']))
    expect(ten).not.toContain('xuat_xml_gtgt') // ghi ra đĩa chỉ có ở bản chạy trên máy
    expect((await c.listTools()).tools.find((t) => t.name === 'xoa_tai_lieu')!.annotations?.destructiveHint).toBe(true)
    expect((await taiPhienAI(uid)).map((p) => p.tenMay)).toEqual(['Máy cơ quan'])
  })

  it('AI đọc được hồ sơ web app đã lưu', async () => {
    const { kq } = await goiCC(c, 'so_theo_doi_gtgt')
    expect(kq.gtgt).toMatchObject([{ quy: '2026-Q1', phienBan: [{ ct43: 5000 }] }])
  })

  it('AI nạp Excel hoá đơn quý 2 -> web app thấy; AI lập tờ khai: [22] = [43] quý 1', async () => {
    const rows = [
      ['Từ ngày 01/04/2026 đến ngày 30/06/2026'],
      ['STT', 'Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'MST người bán', 'Tên người bán', 'MST người mua', 'Tên người mua', 'Tổng tiền chưa thuế', 'Tổng tiền thuế', 'Trạng thái hóa đơn'],
      [1, '1', 'C26TNA', '1', '10/04/2026', MST, hoSo.tenNNT, '0100000001', 'Khách Mười', 100000000, 10000000, 'Hóa đơn mới'],
      [2, '1', 'C26TNA', '2', '20/05/2026', MST, hoSo.tenNNT, '0100000003', 'Khách Tám', 50000000, 4000000, 'Hóa đơn mới'],
      [3, '1', 'C26TBB', '7', '05/06/2026', '0200000002', 'Nhà Cung Cấp', MST, hoSo.tenNNT, 30000000, 3000000, 'Hóa đơn mới'],
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1')
    const b64 = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })).toString('base64')
    const nap = await goiCC(c, 'nap_tai_lieu', { ten_file: 'DANH SÁCH HÓA ĐƠN Q2.xlsx', noi_dung_base64: b64 })
    expect(nap).toMatchObject({ loi: false, kq: { daLuu: true, mst: MST, moTa: '2 hoá đơn bán ra, 1 mua vào' } })

    const may = await taiDuLieuMay(uid) // web app tải về
    expect(may.tepHoaDon[MST]).toMatchObject([{ ten: 'DANH SÁCH HÓA ĐƠN Q2.xlsx', ky: '2026-Q2', soBan: 2, soMua: 1, phu: { ban: ['2026-04', '2026-05', '2026-06'] } }])
    expect(new Uint8Array(await taiTep(may.tepHoaDon[MST][0].duongDan))).toEqual(new Uint8Array(Buffer.from(b64, 'base64')))

    const { kq } = await goiCC(c, 'lap_to_khai_gtgt', { quy: 2, nam: 2026 })
    const ct = Object.fromEntries(kq.chiTieu.map((x: { ma: string; giaTri: number }) => [x.ma, x.giaTri]))
    expect(ct).toMatchObject({ '[22]': 5000, '[33]': 14000000, '[40]': 10995000 })
    expect(kq.coLoi).toBe(false)
  })

  it('AI lưu tờ khai đã lập -> có trong mục "đã xuất" của web app', async () => {
    const { kq } = await goiCC(c, 'luu_xml_gtgt', { quy: 2, nam: 2026, ngay_lap: '2026-07-20' })
    expect(kq.daLuu).toBe(true)
    expect(docToKhai(kq.xml).ct.ct40).toBe(10995000)
    expect((await taiDuLieuMay(uid)).daXuat[MST]).toMatchObject([{ loai: 'gtgt', ky: '2026-Q2', ct40: 10995000 }])
  })

  it('đánh dấu CQT trả về + sửa thông tin công ty -> web app thấy', async () => {
    expect((await goiCC(c, 'danh_dau_tra_ve', { quy: 1, nam: 2026, ten_file: `${MST}000-01_GTGT_TT80-Q12026-L00.xml`, tra_ve: true })).kq.daLuu).toBe(true)
    expect((await goiCC(c, 'sua_thong_tin_cong_ty', { nguoiKy: 'Trần Thị B' })).kq).toMatchObject({ daLuu: true, daSua: ['nguoiKy'] })
    const may = await taiDuLieuMay(uid)
    expect(may.toKhai.find((t) => t.ky === '2026-Q1')!.khongChapNhan).toBe(true)
    expect(may.congTy[0]).toMatchObject({ hoSo: { nguoiKy: 'Trần Thị B', tenNNT: hoSo.tenNNT }, suaTay: true })
    // quý 1 bị trả về -> quý 2 không còn [22] để đối chiếu: AI phải thấy cảnh báo
    const { kq } = await goiCC(c, 'lap_to_khai_gtgt', { quy: 2, nam: 2026 })
    expect(kq.dauKy.ct22TheoQuyTac).toBeNull()
  })

  it('xoá: sai xác nhận thì KHÔNG xoá; đúng tên file mới xoá (cả file gốc)', async () => {
    const ds = (await goiCC(c, 'danh_sach_tai_lieu', { nhom: 'tepHoaDon' })).kq.tepHoaDon
    const tep = ds[0]
    const sai = await goiCC(c, 'xoa_tai_lieu', { nhom: 'tepHoaDon', id: tep.id, xac_nhan: 'có' })
    expect(sai.kq).toMatchObject({ daXoa: false })
    expect((await taiDuLieuMay(uid)).tepHoaDon[MST]).toHaveLength(1)
    const duongDan = (await taiDuLieuMay(uid)).tepHoaDon[MST][0].duongDan
    const dung = await goiCC(c, 'xoa_tai_lieu', { nhom: 'tepHoaDon', id: tep.id, xac_nhan: 'DANH SÁCH HÓA ĐƠN Q2.xlsx' })
    expect(dung.kq).toMatchObject({ daXoa: true })
    expect((await taiDuLieuMay(uid)).tepHoaDon[MST]).toEqual([])
    await expect(taiTep(duongDan)).rejects.toThrow()
  })

  it('nhật ký: web app thấy mọi lần AI ghi / xoá, kèm tên máy', async () => {
    const nk = await taiNhatKyAI(uid, 20)
    expect(nk.map((d) => d.congCu).sort()).toEqual(['danh_dau_tra_ve', 'luu_xml_gtgt', 'nap_tai_lieu', 'sua_thong_tin_cong_ty', 'xoa_tai_lieu'])
    expect(nk.every((d) => d.tenMay === 'Máy cơ quan')).toBe(true)
  })

  it('thu hồi trên web app -> AI bị chặn ngay, vé làm mới cũng hết dùng; máy khác không ảnh hưởng', async () => {
    const ve2 = await ketNoi('Laptop ở nhà')
    const phien = await taiPhienAI(uid)
    await thuHoiPhienAI(uid, phien.find((p) => p.tenMay === 'Máy cơ quan')!.id)

    const bi = await goi('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${ve.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) })
    expect(bi.status).toBe(401)
    const lm = await goi('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: ve.refresh_token }).toString() })
    expect(lm.status).toBe(400)

    const c2 = await moClient(ve2.access_token)
    expect((await goiCC(c2, 'danh_sach_cong_ty')).kq).toHaveLength(1)
    const lm2 = await goi('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: ve2.refresh_token }).toString() })
    expect(lm2.status).toBe(200)
    await c2.close()
  })
})
