// Máy chủ MCP "khaithue": cho Claude Code / Claude Desktop / Codex... (AI nói chung) tra cứu hồ sơ thuế
// và lập tờ khai 01/GTGT bằng ĐÚNG phần tính toán của app. Hai nguồn dữ liệu:
//  - THƯ MỤC trên máy (chay.ts, stdio): chỉ đọc file; ghi duy nhất file XML tờ khai chưa ký vào thư mục xuất.
//  - MÂY (may/web.ts, chạy trên Vercel): đọc + ghi đúng dữ liệu web app, bằng quyền của chính người dùng;
//    thêm công cụ nạp file, đánh dấu trả về, sửa thông tin công ty, lưu tờ khai, xoá (phải xác nhận).
// Không bao giờ nộp gì lên cổng thuế: ký số và nộp luôn do người dùng tự làm.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as cc from './congCu.js'
import type { DuLieu } from './congCu.js'
import * as cm from './may/congCuMay.js'

const HUONG_DAN = `Máy chủ hồ sơ thuế doanh nghiệp (thay HTKK) — tờ khai 01/GTGT, 05/KK-TNCN, hoá đơn, chứng từ nộp tiền.
- Tiền tính bằng đồng (VND), số nguyên. Kỳ dạng "2026-Q3" = quý 3/2026. Ngày dạng dd/MM/yyyy.
- Quy tắc cơ quan thuế: [22] quý này PHẢI bằng [43] trên tờ khai LẦN ĐẦU quý liền trước (không lấy bản bổ sung).
- Số liệu chỉ lấy từ file người dùng đã tải (tờ khai XML, Excel "Danh sách hoá đơn", chứng từ XML). Thiếu file thì nói rõ là thiếu, KHÔNG đoán số.
- Bắt đầu bằng tong_quan để nắm tình hình; lap_to_khai_gtgt để tính thử (không ghi gì); xuat_xml_gtgt chỉ khi người dùng yêu cầu tạo file.
- Không bao giờ tự nộp tờ khai: file XML chưa ký số, người dùng tự ký bằng USB token và nộp trên thuedientu.gdt.gov.vn.
- Kết quả là hỗ trợ tính toán; người nộp chịu trách nhiệm kiểm số liệu trước khi nộp.`

const mst = z.string().optional().describe('MST công ty. Bỏ trống = công ty mặc định')
const quy = z.number().int().min(1).max(4).optional().describe('Quý 1–4')
const nam = z.number().int().min(2000).max(2100).optional().describe('Năm, vd 2026')

const thamSoGTGT = {
  quy: quy.describe('Quý cần khai. Bỏ trống cả quý và năm = quý vừa kết thúc'),
  nam,
  mst,
  nhap_tay: z.object({
    ct21: z.boolean().optional().describe('[21] Không phát sinh mua bán trong kỳ'),
    ct23a: z.number().optional(), ct24a: z.number().optional(),
    ct26: z.number().optional().describe('[26] Doanh thu không chịu thuế'),
    ct32a: z.number().optional(),
    ct37: z.number().optional().describe('[37] Điều chỉnh giảm thuế còn được khấu trừ các kỳ trước'),
    ct38: z.number().optional().describe('[38] Điều chỉnh tăng'),
    ct39a: z.number().optional(), ct40b: z.number().optional(),
    ct42: z.number().optional().describe('[42] Đề nghị hoàn'),
  }).optional().describe('Các chỉ tiêu người khai tự nhập (không có trên hoá đơn)'),
  ct22: z.number().optional().describe('Ghi đè [22]. Chỉ dùng khi cán bộ thuế hướng dẫn — mặc định app tự lấy [43] lần đầu quý trước'),
  them_ngoai_ky: z.array(z.string()).optional().describe('Hoá đơn ngày lập ngoài quý vẫn tính vào quý này, dạng "C26TKL-18" hoặc số hoá đơn'),
  bo_hoa_don: z.array(z.string()).optional().describe('Hoá đơn trong quý muốn bỏ ra, cùng dạng trên'),
  ngay_lap: z.string().optional().describe('Ngày lập tờ khai yyyy-MM-dd (mặc định hôm nay) — chỉ dùng khi xuất XML'),
}

const json = (x: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(x, null, 1) }] })

/** Nguồn dữ liệu cắm vào máy chủ */
export interface NguonMcp {
  lay(): Promise<DuLieu>
  napLai(): Promise<DuLieu>
  /** Chỉ nguồn thư mục: ghi file XML ra đĩa */
  xuatXml?: (d: DuLieu, a: cc.ThamSoLapGTGT) => unknown
  /** Chỉ nguồn mây: ngữ cảnh để ghi (Firebase của người dùng, phiên AI) */
  ghi?: () => Promise<cm.NguCanhMay>
}

type KetQua = { content: { type: 'text'; text: string }[]; isError?: boolean }

export function taoMayChu(nguon: NguonMcp) {
  const server = new McpServer({ name: 'khaithue', version: '2.0.0' }, { instructions: HUONG_DAN + (nguon.ghi ? HUONG_DAN_MAY : '') })

  // Bọc mọi công cụ: lỗi do người dùng/dữ liệu thì trả lời rõ ràng (isError) thay vì làm sập máy chủ
  const boc = <A,>(fn: (a: A) => Promise<unknown>) => async (a: A): Promise<KetQua> => {
    try {
      return json(await fn(a))
    } catch (e) {
      return { ...json({ loi: (e as Error).message }), isError: true }
    }
  }
  const chay = <A,>(fn: (d: DuLieu, a: A) => unknown) => boc(async (a: A) => fn(await nguon.lay(), a))
  const chiDoc = { readOnlyHint: true, openWorldHint: false } as const

  server.registerTool('nap_ho_so', {
    title: 'Nạp lại hồ sơ',
    description: 'Đọc lại toàn bộ thư mục hồ sơ (sau khi người dùng thêm/sửa file) và báo cáo: bao nhiêu file, file nào lỗi, công ty nào. Gọi đầu tiên nếu nghi dữ liệu cũ.',
    inputSchema: {},
    annotations: chiDoc,
  }, boc(async () => cc.baoCaoNap(await nguon.napLai())))

  server.registerTool('danh_sach_cong_ty', {
    title: 'Danh sách công ty',
    description: 'Các công ty có trong hồ sơ: MST, tên, địa chỉ, cơ quan thuế, người ký, số quý đã có tờ khai / hoá đơn / chứng từ.',
    inputSchema: {},
    annotations: chiDoc,
  }, chay((d) => cc.danhSachCongTy(d)))

  server.registerTool('tong_quan', {
    title: 'Tổng quan thuế',
    description: 'Bức tranh toàn bộ: từng quý (tờ khai lần đầu/bổ sung/bị trả về, doanh thu [34], phải nộp [40], đã nộp theo chứng từ, [43], tổng hoá đơn, khớp đầu kỳ), từng năm, hạn nộp sắp tới và các cảnh báo cần xử lý (thiếu tờ khai, nộp thiếu, lệch doanh thu, đứt chuỗi đầu kỳ).',
    inputSchema: { mst, ngay_hom_nay: z.string().optional().describe('Giả định ngày hôm nay yyyy-MM-dd (để tính quá hạn). Mặc định: hôm nay') },
    annotations: chiDoc,
  }, chay(cc.tongQuan))

  server.registerTool('so_theo_doi_gtgt', {
    title: 'Sổ theo dõi tờ khai',
    description: 'Lịch sử tờ khai 01/GTGT từng quý, mọi phiên bản (lần đầu / bổ sung / bị trả về) với các chỉ tiêu chính, và kiểm chuỗi [22] = [43] lần đầu quý trước. Kèm lịch sử 05/KK-TNCN.',
    inputSchema: { mst },
    annotations: chiDoc,
  }, chay(cc.soTheoDoi))

  server.registerTool('lap_to_khai_gtgt', {
    title: 'Tính thử tờ khai 01/GTGT',
    description: 'Tính tờ khai 01/GTGT của một quý từ hoá đơn Excel đã tải, đúng công thức app/HTKK: toàn bộ chỉ tiêu [21]–[43], phụ lục giảm thuế (mục I mua vào 8%, mục II bán ra được giảm), cảnh báo/lỗi, và so với tờ khai đã nộp của quý đó (nếu có). KHÔNG ghi file.',
    inputSchema: thamSoGTGT,
    annotations: chiDoc,
  }, chay((d, a: cc.ThamSoLapGTGT) => {
    const { _toKhai, _ky, ...kq } = cc.lapToKhaiGTGT(d, a)
    return kq
  }))

  const xuatXml = nguon.xuatXml
  if (xuatXml) server.registerTool('xuat_xml_gtgt', {
    title: 'Xuất file XML tờ khai 01/GTGT',
    description: 'Như lap_to_khai_gtgt, rồi GHI file XML (chuẩn HTKK, chưa ký số) vào thư mục xuất trên máy. Từ chối nếu tờ khai còn lỗi. Không nộp lên cổng thuế. Chỉ gọi khi người dùng yêu cầu tạo file.',
    inputSchema: thamSoGTGT,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, chay((d, a: cc.ThamSoLapGTGT) => xuatXml(d, a)))

  server.registerTool('tra_hoa_don', {
    title: 'Tra hoá đơn',
    description: 'Tìm hoá đơn bán ra / mua vào theo quý, năm, chiều, hoặc từ khoá (tên đối tác, MST, "ký hiệu-số", số hoá đơn). Mặc định bỏ hoá đơn đã bị thay thế/huỷ. Trả tổng tiền của toàn bộ kết quả khớp và tối đa gioi_han dòng.',
    inputSchema: {
      mst, quy, nam,
      loai: z.enum(['ban', 'mua']).optional().describe('ban = bán ra, mua = mua vào'),
      tim: z.string().optional().describe('Từ khoá: tên đối tác, MST, số hoá đơn, "C26TKL-18"'),
      ca_huy: z.boolean().optional().describe('true = gồm cả hoá đơn bị thay thế/huỷ'),
      gioi_han: z.number().int().min(1).max(500).optional().describe('Số dòng tối đa (mặc định 50)'),
    },
    annotations: chiDoc,
  }, chay(cc.traHoaDon))

  server.registerTool('doi_tac', {
    title: 'Khách hàng & nhà cung cấp',
    description: 'Xếp hạng khách hàng (bán ra) và nhà cung cấp (mua vào) theo giá trị: số hoá đơn, tỷ trọng, lần gần nhất. Quý thiếu hoá đơn thì lấy từ phụ lục tờ khai (có ghi nguồn từng quý).',
    inputSchema: { mst, nam: nam.describe('Năm. Bỏ trống = tất cả các năm'), top: z.number().int().min(1).max(200).optional().describe('Bao nhiêu đối tác mỗi chiều (mặc định 20)') },
    annotations: chiDoc,
  }, chay(cc.doiTac))

  server.registerTool('doi_soat', {
    title: 'Đối soát tờ khai ↔ hoá đơn',
    description: 'So tờ khai đã nộp với hoá đơn từng quý: doanh thu [34] và mua vào [23] lệch tổng hoá đơn bao nhiêu, tháng nào đã có danh sách hoá đơn, và tới từng đối tác lệch giữa phụ lục giảm thuế và hoá đơn (kèm số hoá đơn).',
    inputSchema: { mst, quy, nam, chi_lech: z.boolean().optional().describe('true = chỉ hiện quý có lệch') },
    annotations: chiDoc,
  }, chay(cc.doiSoat))

  server.registerTool('chung_tu_nop_tien', {
    title: 'Chứng từ nộp tiền',
    description: 'Các giấy nộp tiền vào ngân sách đã có: số, ngày, tổng tiền, từng dòng (loại thuế theo tiểu mục, kỳ thuế).',
    inputSchema: { mst, nam },
    annotations: chiDoc,
  }, chay(cc.chungTuNopTien))

  if (nguon.ghi) dangKyCongCuGhi(server, nguon.ghi, boc)
  return server
}

const HUONG_DAN_MAY = `
- Nguồn: dữ liệu THẬT trên mây của web app. Công cụ ghi (nap_tai_lieu, danh_dau_tra_ve, sua_thong_tin_cong_ty, luu_xml_gtgt, xoa_tai_lieu) thay đổi dữ liệu thật — chỉ gọi khi người dùng yêu cầu rõ.
- xoa_tai_lieu không hoàn tác được: phải hỏi người dùng, nêu đúng tên file, được đồng ý rồi mới gửi xac_nhan = tên file.
- Mọi lần ghi/xoá được ghi nhật ký; người dùng xem và thu hồi quyền của máy này trên web app.`

type Boc = <A>(fn: (a: A) => Promise<unknown>) => (a: A) => Promise<KetQua>
type Nhom = 'toKhai' | 'tepHoaDon' | 'chungTu' | 'daXuat'

function dangKyCongCuGhi(server: McpServer, ghi: () => Promise<cm.NguCanhMay>, boc: Boc) {
  const ghiDuoc = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const
  const nhom = z.enum(['toKhai', 'tepHoaDon', 'chungTu', 'daXuat'])

  server.registerTool('danh_sach_tai_lieu', {
    title: 'Danh sách tài liệu trên mây',
    description: 'Mọi file đã lưu trên mây của một công ty, kèm mã (id): tờ khai (mọi mẫu, có cờ bị trả về), file hoá đơn, chứng từ nộp tiền, tờ khai app đã lập. Dùng trước khi đánh dấu hoặc xoá.',
    inputSchema: { mst, nhom: nhom.optional().describe('Chỉ một nhóm') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, boc(async (a: { mst?: string; nhom?: Nhom }) => cm.danhSachTaiLieu(await ghi(), a)))

  server.registerTool('nap_tai_lieu', {
    title: 'Nạp file lên hồ sơ',
    description: 'Lưu MỘT file vào hồ sơ trên mây, y như kéo file vào web app: tờ khai XML đã nộp (mọi mẫu), chứng từ nộp tiền XML, hoá đơn XML, hoặc Excel/CSV "Danh sách hóa đơn". XML gửi nguyên văn ở noi_dung; Excel gửi base64 ở noi_dung_base64. Nạp lại đúng file cũ không sinh bản trùng.',
    inputSchema: {
      ten_file: z.string().describe('Tên file gốc, vd "0100000000000-01_GTGT_TT80-Q32026-L00.xml"'),
      noi_dung: z.string().optional().describe('Nội dung XML (hoặc CSV) nguyên văn'),
      noi_dung_base64: z.string().optional().describe('Nội dung file Excel mã hoá base64'),
    },
    annotations: { ...ghiDuoc, idempotentHint: true },
  }, boc(async (a: { ten_file: string; noi_dung?: string; noi_dung_base64?: string }) => cm.napTaiLieuLenMay(await ghi(), a)))

  server.registerTool('danh_dau_tra_ve', {
    title: 'Đánh dấu tờ khai bị CQT trả về',
    description: 'Như tích "CQT trả về" trên web app: phiên bản tờ khai 01/GTGT bị cơ quan thuế KHÔNG chấp nhận sẽ không được dùng để tính [22] quý sau. tra_ve=false để bỏ đánh dấu.',
    inputSchema: {
      quy: z.number().int().min(1).max(4), nam: z.number().int(),
      ten_file: z.string().describe('Tên file tờ khai (xem so_theo_doi_gtgt hoặc danh_sach_tai_lieu)'),
      tra_ve: z.boolean(), mst,
    },
    annotations: { ...ghiDuoc, idempotentHint: true },
  }, boc(async (a: { quy: number; nam: number; ten_file: string; tra_ve: boolean; mst?: string }) => cm.danhDauTraVe(await ghi(), a)))

  const o = z.string().optional()
  server.registerTool('sua_thong_tin_cong_ty', {
    title: 'Sửa thông tin công ty',
    description: 'Sửa thông tin người nộp thuế dùng khi lập tờ khai (chỉ gửi ô cần đổi). Sau khi sửa, tờ khai XML nạp sau không ghi đè các ô này.',
    inputSchema: { mst, tenNNT: o, dchiNNT: o, phuongXa: o, maXaNNT: o, maTinhNNT: o, tenTinhNNT: o, dthoaiNNT: o, emailNNT: o, maCQTNoiNop: o, tenCQTNoiNop: o, nguoiKy: o },
    annotations: { ...ghiDuoc, idempotentHint: true },
  }, boc(async (a: Record<string, string | undefined>) => cm.suaThongTinCongTy(await ghi(), a)))

  server.registerTool('luu_xml_gtgt', {
    title: 'Lập và lưu tờ khai 01/GTGT',
    description: 'Như lap_to_khai_gtgt, rồi lưu file XML (chuẩn HTKK, CHƯA ký số) vào mục "đã xuất" của hồ sơ và trả nội dung XML (để lưu ra máy nếu người dùng muốn). Từ chối nếu tờ khai còn lỗi. KHÔNG nộp lên cổng thuế.',
    inputSchema: thamSoGTGT,
    annotations: { ...ghiDuoc, idempotentHint: true },
  }, boc(async (a: cc.ThamSoLapGTGT) => cm.luuXmlGTGT(await ghi(), a)))

  server.registerTool('xoa_tai_lieu', {
    title: 'XOÁ một tài liệu (không hoàn tác)',
    description: 'Xoá hẳn MỘT file khỏi hồ sơ trên mây (file gốc + số liệu). KHÔNG hoàn tác được. Bắt buộc: hỏi người dùng trước, nêu đúng tên file; chỉ khi họ đồng ý mới gửi xac_nhan = đúng tên file. Gửi sai xac_nhan thì không xoá và trả về tên file cần xác nhận.',
    inputSchema: {
      nhom: nhom.describe('Nhóm tài liệu (xem danh_sach_tai_lieu)'),
      id: z.string().describe('Mã tài liệu (xem danh_sach_tai_lieu)'),
      xac_nhan: z.string().describe('Đúng bằng tên file sẽ bị xoá'),
      mst,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, boc(async (a: { nhom: Nhom; id: string; xac_nhan: string; mst?: string }) => cm.xoaTaiLieu(await ghi(), a)))
}
