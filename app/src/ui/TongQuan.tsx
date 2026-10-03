import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react'
import { tenKy } from '../core/kho'
import { tien } from '../core/nhan'
import { tenTieuMuc } from '../core/taiLieu'
import type { DoiSoatChieu, DoiSoatQuy, DoiTac, DongDoiTac, DongQuy, NguonQuy, TongQuan as TQ } from '../core/tongQuan'
import { DanhSachCanhBao } from './chung'

const trieu = (n: number) => (Math.abs(n) >= 1e9 ? `${(n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ` : `${Math.round(n / 1e6).toLocaleString('vi-VN')} tr`)

/** Ô nạp hàng loạt: chọn nhiều file hoặc cả thư mục */
export function NapHangLoat({ onFiles, tienDo }: { onFiles: (f: File[]) => void; tienDo: { xong: number; tong: number; dangLam: string } | null }) {
  const tepRef = useRef<HTMLInputElement>(null)
  const thuMucRef = useRef<HTMLInputElement>(null)
  const [keo, setKeo] = useState(false)
  const nhan = (ds: FileList | null) => {
    const loc = [...(ds ?? [])].filter((f) => /\.(xml|xlsx|xls|csv)$/i.test(f.name))
    if (loc.length) onFiles(loc)
  }
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setKeo(true)
      }}
      onDragLeave={() => setKeo(false)}
      onDrop={(e) => {
        e.preventDefault()
        setKeo(false)
        nhan(e.dataTransfer.files)
      }}
      className={`rounded-xl border-2 border-dashed p-5 text-center ${keo ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'}`}
    >
      <input ref={tepRef} type="file" multiple accept=".xml,.xlsx,.xls,.csv" className="hidden" onChange={(e) => { nhan(e.target.files); e.target.value = '' }} />
      {/* @ts-expect-error webkitdirectory: chọn cả thư mục (Chrome, Edge) */}
      <input ref={thuMucRef} type="file" webkitdirectory="" multiple className="hidden" onChange={(e) => { nhan(e.target.files); e.target.value = '' }} />
      <div className="text-lg font-medium">Nạp toàn bộ hồ sơ thuế</div>
      <p className="mt-1 text-sm text-slate-600">
        Tờ khai XML (mọi mẫu), chứng từ nộp tiền XML, hoá đơn XML, Excel “Danh sách hóa đơn” — từ năm thành lập đến nay. Kéo thả vào đây, hoặc:
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <button disabled={!!tienDo} onClick={() => thuMucRef.current?.click()} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:bg-slate-300">Chọn cả thư mục</button>
        <button disabled={!!tienDo} onClick={() => tepRef.current?.click()} className="rounded-lg border border-emerald-600 px-4 py-2 font-medium text-emerald-700 disabled:opacity-50">Chọn file</button>
      </div>
      {tienDo && (
        <div className="mx-auto mt-3 max-w-md text-left">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${(100 * tienDo.xong) / Math.max(tienDo.tong, 1)}%` }} />
          </div>
          <div className="mt-1 text-sm text-slate-600">Đang xử lý {tienDo.xong}/{tienDo.tong}: {tienDo.dangLam}</div>
        </div>
      )}
    </div>
  )
}

function The({ nhan, giaTri, phu }: { nhan: string; giaTri: string; phu?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-sm text-slate-500">{nhan}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-900 sm:text-2xl">{giaTri}</div>
      {phu && <div className="text-xs text-slate-500">{phu}</div>}
    </div>
  )
}

/** Cột đôi theo quý: doanh thu (xanh) và mua vào (cam), từ tờ khai 01/GTGT */
function BieuDoQuy({ quy }: { quy: DongQuy[] }) {
  const [chon, setChon] = useState<number | null>(null)
  const ds = [...quy].reverse().slice(-12)
  const max = Math.max(1, ...ds.flatMap((q) => [q.hieuLuc?.ct34 ?? 0, q.hieuLuc?.ct23 ?? 0]))
  const W = 720, H = 220, L = 8, B = 28, T = 10
  const nhom = (W - L * 2) / Math.max(ds.length, 1)
  const cot = Math.min(22, (nhom - 10) / 2)
  const y = (v: number) => H - B - ((H - B - T) * v) / max
  const cotBo = (x: number, v: number) => {
    const top = y(v), h = H - B - top
    if (h <= 0) return ''
    const r = Math.min(4, h, cot / 2)
    return `M${x},${H - B} V${top + r} Q${x},${top} ${x + r},${top} H${x + cot - r} Q${x + cot},${top} ${x + cot},${top + r} V${H - B} Z`
  }
  const q = chon !== null ? ds[chon] : null
  return (
    <div className="viz-root">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Doanh thu và mua vào theo quý (theo tờ khai 01/GTGT)</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--series-1)' }} /> Doanh thu [34]</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: 'var(--series-2)' }} /> Mua vào [23]</span>
      </div>
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img" aria-label="Biểu đồ doanh thu và mua vào theo quý">
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line x1={L} x2={W - L} y1={y(max * p)} y2={y(max * p)} stroke="#e7e5e4" strokeWidth={1} />
              <text x={W - L} y={y(max * p) - 3} textAnchor="end" fontSize={10} fill="#78716c">{trieu(max * p)}</text>
            </g>
          ))}
          <line x1={L} x2={W - L} y1={H - B} y2={H - B} stroke="#a8a29e" strokeWidth={1} />
          {ds.map((d, i) => {
            const x0 = L + i * nhom + (nhom - cot * 2 - 2) / 2
            return (
              <g key={d.khoa} onMouseEnter={() => setChon(i)} onMouseLeave={() => setChon(null)} onClick={() => setChon(i)}>
                <rect x={L + i * nhom} y={T} width={nhom} height={H - B - T} fill={chon === i ? '#f5f5f4' : 'transparent'} />
                {d.hieuLuc ? (
                  <>
                    <path d={cotBo(x0, d.hieuLuc.ct34 ?? 0)} fill="var(--series-1)" />
                    <path d={cotBo(x0 + cot + 2, d.hieuLuc.ct23 ?? 0)} fill="var(--series-2)" />
                  </>
                ) : (
                  <text x={L + i * nhom + nhom / 2} y={H - B - 6} textAnchor="middle" fontSize={10} fill="#b91c1c">thiếu TK</text>
                )}
                <text x={L + i * nhom + nhom / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="#57534e">{tenKy(d.khoa).replace('/20', '/')}</text>
              </g>
            )
          })}
        </svg>
        {q && (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow">
            <b>Quý {tenKy(q.khoa)}</b>
            {q.hieuLuc ? (
              <>
                <div>Doanh thu: <b className="tabular-nums">{tien(q.hieuLuc.ct34 ?? 0)}</b></div>
                <div>Mua vào: <b className="tabular-nums">{tien(q.hieuLuc.ct23 ?? 0)}</b></div>
                <div>Thuế phải nộp: <b className="tabular-nums">{tien(q.hieuLuc.ct40)}</b></div>
              </>
            ) : <div className="text-red-700">Chưa có tờ khai</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function OTrangThai({ q }: { q: DongQuy }) {
  if (q.biTraVe) return <span className="text-red-700">⛔ bị trả về</span>
  if (!q.hieuLuc) return q.quaHan ? <span className="text-red-700">⛔ thiếu</span> : <span className="text-slate-400">chưa đến hạn</span>
  if (q.hieuLuc.nguon === 'app') return <span className="text-amber-700">⚠️ app xuất, chưa thấy bản nộp</span>
  return <span className="text-emerald-700">✅ {q.coBoSung ? 'có bổ sung' : 'lần đầu'}</span>
}

// ---------- Khung thu gọn / mở rộng (nhớ trạng thái trên máy này) ----------

const KHOA_THU_GON = 'tq:thuGon'
function docThuGon(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KHOA_THU_GON) ?? '{}')
  } catch {
    return {}
  }
}

function PhanThuGon({ id, tieuDe, phu, dong, setDong, children }: {
  id: string
  tieuDe: ReactNode
  phu?: ReactNode
  dong: Record<string, boolean>
  setDong: (d: Record<string, boolean>) => void
  children: ReactNode
}) {
  const mo = !dong[id]
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button className="flex items-center gap-2 text-left hover:text-emerald-800" aria-expanded={mo} onClick={() => setDong({ ...dong, [id]: mo })}>
          <span className="w-4 text-slate-500">{mo ? '▾' : '▸'}</span>
          <span className="font-semibold">{tieuDe}</span>
        </button>
        {phu && <span className="ml-auto text-sm text-slate-500">{phu}</span>}
      </div>
      {mo && <div className="border-t border-slate-100 p-3">{children}</div>}
    </section>
  )
}

// ---------- Bảng đối tác ----------

/** Dòng ghi chú: quý nào lấy đối tác từ nguồn nào */
function GhiChuNguon({ nguonQuy, loai }: { nguonQuy: DoiTac['nguonQuy']; loai: 'ban' | 'mua' }) {
  const nhom = (n: NguonQuy) => nguonQuy.filter((q) => q[loai] === n).map((q) => tenKy(q.khoa))
  const dong: [string, string[], string][] = [
    ['Theo hoá đơn (danh sách trọn kỳ)', nhom('hoaDon'), 'text-emerald-800'],
    [
      'Theo phụ lục tờ khai 01/GTGT',
      [
        ...nhom('toKhai'),
        ...nguonQuy
          .filter((q) => q[loai] === 'toKhaiThieuHD')
          .map((q) => {
            const thieu = q.thangThieu?.[loai] ?? []
            return `${tenKy(q.khoa)} (danh sách hoá đơn chưa đủ${thieu.length ? `: thiếu tháng ${thieu.map((t) => Number(t.slice(5))).join(', ')}` : ''})`
          }),
      ],
      'text-slate-700',
    ],
    ['Chưa có dữ liệu', nhom('thieu'), 'text-amber-800'],
  ]
  return (
    <div className="mt-2 space-y-0.5 text-xs">
      {dong.filter(([, ds]) => ds.length).map(([nhan, ds, mau]) => (
        <div key={nhan} className={mau}><b>{nhan}:</b> quý {ds.join(', ')}</div>
      ))}
      <div className="text-slate-500">
        Phụ lục tờ khai chỉ có tên đối tác (không MST, không số hoá đơn){loai === 'mua' ? ' và chỉ kê hàng mua vào chịu thuế 8%' : ''}. Nạp file Excel “Danh sách hóa đơn” của quý đó để có số liệu chi tiết.
      </div>
    </div>
  )
}

function BangDoiTac({ ds, tong, loai, nguonQuy }: { ds: DongDoiTac[]; tong: number; loai: 'ban' | 'mua'; nguonQuy: DoiTac['nguonQuy'] }) {
  const [tatCa, setTatCa] = useState(false)
  const [tim, setTim] = useState('')
  if (!ds.length)
    return (
      <div>
        <p className="text-sm text-slate-500">Chưa có dữ liệu {loai === 'ban' ? 'khách hàng' : 'nhà cung cấp'} trong khoảng này.</p>
        <GhiChuNguon nguonQuy={nguonQuy} loai={loai} />
      </div>
    )
  const loc = ds.filter((d) => !tim || d.ten.toLowerCase().includes(tim.toLowerCase()) || d.mst.includes(tim))
  const hien = tatCa || tim ? loc : loc.slice(0, 10)
  const lon = ds[0]
  return (
    <div>
      {loai === 'ban' && ds.length === 1 && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">⚠️ Toàn bộ doanh thu đến từ một khách hàng duy nhất.</p>
      )}
      {loai === 'ban' && ds.length > 1 && lon.tyTrong >= 0.5 && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ⚠️ Doanh thu phụ thuộc lớn vào một khách: <b>{lon.ten}</b> chiếm {(lon.tyTrong * 100).toFixed(0)}% doanh số bán ra.
        </p>
      )}
      <input
        className="mb-2 w-full max-w-xs rounded-lg border border-slate-300 px-2 py-1 text-sm"
        placeholder="Tìm theo tên hoặc MST…"
        value={tim}
        onChange={(e) => setTim(e.target.value)}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="p-1">{loai === 'ban' ? 'Khách hàng' : 'Nhà cung cấp'}</th>
              <th className="p-1">MST</th>
              <th className="p-1 text-right">Số HĐ</th>
              <th className="p-1 text-right">Giá trị chưa thuế</th>
              <th className="p-1 text-right">Thuế GTGT</th>
              <th className="p-1">Tỷ trọng</th>
              <th className="p-1">Gần nhất</th>
              <th className="p-1 text-right">Số quý</th>
            </tr>
          </thead>
          <tbody>
            {hien.map((d) => (
              <tr key={d.khoa} className="border-t border-slate-100">
                <td className="p-1">
                  {d.ten}
                  {d.tuToKhai && <span className="ml-1 rounded bg-slate-100 px-1 text-xs text-slate-600" title="Có phần số liệu lấy từ phụ lục tờ khai 01/GTGT">theo tờ khai</span>}
                </td>
                <td className="p-1 tabular-nums text-slate-500">{d.mst || '—'}</td>
                <td className="p-1 text-right tabular-nums" title={d.tuToKhai ? 'Chỉ đếm được hoá đơn ở các quý đã nạp danh sách hoá đơn; các quý lấy từ phụ lục tờ khai không có số hoá đơn' : undefined}>
                  {d.n ? `${d.n}${d.tuToKhai ? '+' : ''}` : '—'}
                </td>
                <td className="p-1 text-right tabular-nums">{tien(d.v)}</td>
                <td className="p-1 text-right tabular-nums">{tien(d.t)}</td>
                <td className="p-1">
                  <div className="flex items-center gap-2" title={`${(d.tyTrong * 100).toFixed(1)}%`}>
                    <div className="h-2 w-24 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(d.tyTrong * 100, 1)}%`, background: loai === 'ban' ? 'var(--series-1)' : 'var(--series-2)' }} />
                    </div>
                    <span className="tabular-nums text-slate-600">{(d.tyTrong * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td className="whitespace-nowrap p-1 text-slate-600">{d.cuoi}</td>
                <td className="p-1 text-right tabular-nums">{d.soQuy}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 font-semibold">
              <td className="p-1" colSpan={3}>Cộng ({ds.length} đối tác)</td>
              <td className="p-1 text-right tabular-nums">{tien(tong)}</td>
              <td className="p-1 text-right tabular-nums">{tien(ds.reduce((s, d) => s + d.t, 0))}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
      {!tim && loc.length > 10 && (
        <button className="mt-1 text-sm text-emerald-700 underline" onClick={() => setTatCa(!tatCa)}>
          {tatCa ? 'Chỉ xem 10 đối tác lớn nhất' : `Xem tất cả ${loc.length} đối tác`}
        </button>
      )}
      <GhiChuNguon nguonQuy={nguonQuy} loai={loai} />
    </div>
  )
}


// ---------- Đối soát tờ khai ↔ hoá đơn ----------

function OLech({ c }: { c: DoiSoatChieu }) {
  if (c.tk === null && !c.n) return <span className="text-slate-400">—</span>
  if (c.lech === null) return <span className="text-slate-400">{c.tk === null ? 'chưa có tờ khai' : 'chưa có hoá đơn'}</span>
  if (Math.abs(c.lech) <= 1000) return <span className="text-emerald-700">✅ khớp</span>
  return <b className="text-amber-800">⚠️ {c.lech > 0 ? '+' : ''}{tien(c.lech)}</b>
}

function DoiSoat({ ds }: { ds: DoiSoatQuy[] }) {
  const [mo, setMo] = useState<string | null>(null)
  if (!ds.length) return <p className="text-sm text-slate-500">Chưa có dữ liệu để đối soát.</p>
  const thang = (ts: string[]) => (ts.length ? ts.map((t) => Number(t.slice(5))).join(', ') : '—')
  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">
        So tờ khai 01/GTGT với hoá đơn đã nạp. <b>Lệch không có nghĩa là sai</b>: có thể do thiếu file của một tháng, hoá đơn thuế suất khác 8%, hoá đơn ngoài quý, hoặc tờ khai đã khai bổ sung. Bấm “Xem” để thấy lệch ở đối tác nào, hoá đơn nào.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="p-2">Quý</th>
              <th className="p-2 text-right">Bán ra: tờ khai [34]</th>
              <th className="p-2 text-right">Hoá đơn</th>
              <th className="p-2">Bán ra</th>
              <th className="p-2 text-right">Mua vào: tờ khai [23]</th>
              <th className="p-2 text-right">Hoá đơn</th>
              <th className="p-2">Mua vào</th>
              <th className="p-2">Tháng đã có danh sách (bán / mua)</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {ds.map((q) => (
              <Fragment key={q.khoa}>
                <tr className="border-t border-slate-100">
                  <td className="p-2 font-medium">{tenKy(q.khoa)}</td>
                  <td className="p-2 text-right tabular-nums">{q.ban.tk !== null ? tien(q.ban.tk) : '—'}</td>
                  <td className="p-2 text-right tabular-nums">{q.ban.n ? `${tien(q.ban.hd)} (${q.ban.n})` : '—'}</td>
                  <td className="p-2"><OLech c={q.ban} /></td>
                  <td className="p-2 text-right tabular-nums">{q.mua.tk !== null ? tien(q.mua.tk) : '—'}</td>
                  <td className="p-2 text-right tabular-nums">{q.mua.n ? `${tien(q.mua.hd)} (${q.mua.n})` : '—'}</td>
                  <td className="p-2"><OLech c={q.mua} /></td>
                  <td className="p-2 text-slate-600">{thang(q.ban.thangCo)} / {thang(q.mua.thangCo)}</td>
                  <td className="p-2">
                    {q.doiTac.length > 0 && (
                      <button className="text-emerald-700 underline" onClick={() => setMo(mo === q.khoa ? null : q.khoa)}>
                        {mo === q.khoa ? 'Ẩn' : `Xem ${q.doiTac.length} đối tác lệch`}
                      </button>
                    )}
                  </td>
                </tr>
                {mo === q.khoa && (
                  <tr>
                    <td colSpan={9} className="bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">So phần chịu thuế 8% trên hoá đơn với phụ lục tờ khai (phụ lục chỉ kê hàng 8%).</div>
                      <table className="mt-1 w-full text-sm">
                        <thead className="text-left text-slate-500">
                          <tr>
                            <th className="p-1">Chiều</th>
                            <th className="p-1">Đối tác</th>
                            <th className="p-1 text-right">Hoá đơn (8%)</th>
                            <th className="p-1 text-right">Phụ lục</th>
                            <th className="p-1 text-right">Lệch</th>
                            <th className="p-1">Các hoá đơn của đối tác trong quý</th>
                          </tr>
                        </thead>
                        <tbody>
                          {q.doiTac.map((d, i) => (
                            <tr key={i} className="border-t border-slate-200 align-top">
                              <td className="p-1">{d.l === 'ban' ? 'Bán ra' : 'Mua vào'}</td>
                              <td className="p-1">{d.ten}{d.mst && <span className="text-slate-400"> ({d.mst})</span>}</td>
                              <td className="p-1 text-right tabular-nums">{tien(d.hd)}</td>
                              <td className="p-1 text-right tabular-nums">{tien(d.pl)}</td>
                              <td className="p-1 text-right font-semibold tabular-nums text-amber-800">{d.lech > 0 ? '+' : ''}{tien(d.lech)}</td>
                              <td className="p-1 text-xs text-slate-600">
                                {d.hoaDon.length
                                  ? d.hoaDon.map((h) => `${h.kh}-${h.so} (${h.ng}) ${tien(h.v)}${/thay thế|điều chỉnh/i.test(h.tt) ? ` [${h.tt}]` : ''}`).join('; ')
                                  : 'không có hoá đơn nào — chỉ có trên phụ lục'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const CAC_PHAN = ['soLieu', 'bieuDo', 'canXuLy', 'theoQuy', 'doiSoat', 'khachHang', 'nhaCungCap', 'chungTu', 'khac']

export function TongQuanDN({ tq, tenCty, onMoQuy, layDoiTac, doiSoat }: {
  tq: TQ
  tenCty: string
  onMoQuy: (khoa: string) => void
  layDoiTac: (nam: number | null) => DoiTac
  doiSoat: DoiSoatQuy[]
}) {
  const cacNam = tq.nam.map((n) => n.nam)
  const [nam, setNam] = useState<number | null>(null)
  const [namDT, setNamDT] = useState<number | 'tatCa' | null>(null)
  const [dong, setDongState] = useState<Record<string, boolean>>(docThuGon)
  const setDong = (d: Record<string, boolean>) => {
    setDongState(d)
    try {
      localStorage.setItem(KHOA_THU_GON, JSON.stringify(d))
    } catch {
      /* bỏ qua */
    }
  }
  // Mặc định: năm gần nhất có tờ khai
  const namMacDinh = tq.nam.find((x) => x.soQuyCoToKhai > 0)?.nam ?? cacNam[0]
  const n = tq.nam.find((x) => x.nam === (nam ?? namMacDinh))
  // Đối tác: mặc định theo năm đang xem ở trên; chọn được "tất cả các năm"
  const namDoiTac = namDT === 'tatCa' ? null : (namDT ?? n?.nam ?? null)
  const dt = useMemo(() => layDoiTac(namDoiTac), [layDoiTac, namDoiTac])
  const loi = useMemo(() => tq.canhBao.filter((c) => c.muc === 'loi').length, [tq])

  if (!tq.quy.length) return <p className="text-slate-500">Chưa có hồ sơ nào của {tenCty}. Nạp các file tờ khai, chứng từ, hoá đơn ở ô trên.</p>

  const chonNamDT = (
    <select
      className="rounded-lg border border-slate-300 px-2 py-0.5 text-sm"
      value={namDoiTac === null ? 'tatCa' : String(namDoiTac)}
      onChange={(e) => setNamDT(e.target.value === 'tatCa' ? 'tatCa' : Number(e.target.value))}
    >
      <option value="tatCa">Tất cả các năm</option>
      {cacNam.map((x) => <option key={x} value={x}>Năm {x}</option>)}
    </select>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {tq.hanToi && (
          <span className={`rounded-full px-3 py-1 ${tq.hanToi.daCoToKhai ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
            Quý {tenKy(tq.hanToi.khoa)}: hạn nộp <b>{tq.hanToi.han}</b>{' '}
            {tq.hanToi.daCoToKhai ? '— đã nộp ✅' : `${tq.hanToi.daXuat ? '— app đã xuất, chưa thấy bản đã nộp ' : ''}${tq.hanToi.conNgay >= 0 ? `— còn ${tq.hanToi.conNgay} ngày` : '— ĐÃ QUÁ HẠN'}`}
          </span>
        )}
        <span className="text-sm text-slate-500">Hồ sơ từ quý {tq.tuQuy ? tenKy(tq.tuQuy) : '—'}</span>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          <button className="text-emerald-700 underline" onClick={() => setDong({})}>Mở hết</button>
          <button className="text-emerald-700 underline" onClick={() => setDong(Object.fromEntries(CAC_PHAN.map((k) => [k, true])))}>Thu gọn hết</button>
          <label>
            Năm{' '}
            <select className="rounded-lg border border-slate-300 px-2 py-1" value={n?.nam} onChange={(e) => setNam(Number(e.target.value))}>
              {cacNam.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
        </div>
      </div>

      {n && (
        <PhanThuGon id="soLieu" tieuDe={`Số liệu năm ${n.nam}`} dong={dong} setDong={setDong}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <The nhan={`Doanh thu ${n.nam}`} giaTri={trieu(n.doanhThu)} phu={`${tien(n.doanhThu)} đ`} />
            <The nhan={`Mua vào ${n.nam}`} giaTri={trieu(n.muaVao)} phu={`${tien(n.muaVao)} đ`} />
            <The nhan="Thuế GTGT phải nộp" giaTri={`${tien(n.phaiNop)} đ`} phu={`${n.soQuyCoToKhai}/4 quý đã có tờ khai`} />
            <The nhan="Đã nộp (theo chứng từ)" giaTri={`${tien(n.daNop)} đ`} phu={n.daNop >= n.phaiNop ? 'đủ' : `chênh ${tien(n.phaiNop - n.daNop)} đ`} />
          </div>
        </PhanThuGon>
      )}

      <PhanThuGon id="bieuDo" tieuDe="Biểu đồ doanh thu và mua vào theo quý" dong={dong} setDong={setDong}>
        <BieuDoQuy quy={tq.quy} />
      </PhanThuGon>

      <PhanThuGon id="canXuLy" tieuDe={<>Cần xử lý {loi > 0 && <span className="text-red-700">({loi} lỗi)</span>}</>} phu={`${tq.canhBao.length} mục`} dong={dong} setDong={setDong}>
        {tq.canhBao.length ? <DanhSachCanhBao ds={tq.canhBao} /> : <p className="text-emerald-700">✅ Không có gì cần xử lý.</p>}
      </PhanThuGon>

      <PhanThuGon id="theoQuy" tieuDe="Theo dõi từng quý" phu={`${tq.quy.length} quý`} dong={dong} setDong={setDong}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-2">Quý</th>
                <th className="p-2">01/GTGT</th>
                <th className="p-2">TNCN</th>
                <th className="p-2 text-right">Doanh thu (tờ khai)</th>
                <th className="p-2 text-right">HĐ bán ra</th>
                <th className="p-2 text-right">Phải nộp</th>
                <th className="p-2 text-right">Đã nộp</th>
                <th className="p-2">Đầu kỳ</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {tq.quy.map((q) => {
                const lechHD = q.hieuLuc && q.hoaDon && q.hoaDon.ban.n > 0 && Math.abs((q.hieuLuc.ct34 ?? 0) - q.hoaDon.ban.v) > 1000
                const thieuNop = q.coChungTu && (q.phaiNop ?? 0) > q.daNop
                return (
                  <tr key={q.khoa} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{tenKy(q.khoa)}</td>
                    <td className="p-2"><OTrangThai q={q} /></td>
                    <td className="p-2">{q.coTNCN ? '✅' : <span className="text-slate-400">—</span>}</td>
                    <td className="p-2 text-right tabular-nums">{q.hieuLuc ? tien(q.hieuLuc.ct34 ?? 0) : '—'}</td>
                    <td className={`p-2 text-right tabular-nums ${lechHD ? 'font-semibold text-amber-800' : ''}`}>
                      {q.hoaDon ? `${tien(q.hoaDon.ban.v)} (${q.hoaDon.ban.n})` : <span className="text-slate-400">chưa nạp</span>}
                      {lechHD && ' ⚠️'}
                    </td>
                    <td className="p-2 text-right tabular-nums">{q.phaiNop !== null ? tien(q.phaiNop) : '—'}</td>
                    <td className={`p-2 text-right tabular-nums ${thieuNop ? 'font-semibold text-red-700' : ''}`}>
                      {q.coChungTu ? tien(q.daNop) : <span className="text-slate-400">chưa nạp CT</span>}
                    </td>
                    <td className="p-2">{q.khopDauKy === null ? <span className="text-slate-400">—</span> : q.khopDauKy ? '✅' : <b className="text-red-700">⛔</b>}</td>
                    <td className="p-2"><button className="text-emerald-700 underline" onClick={() => onMoQuy(q.khoa)}>Kê khai</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-500">Số liệu lấy theo bản tờ khai đang có hiệu lực (bổ sung mới nhất, không có thì bản lần đầu). Bản bị cơ quan thuế trả về không tính.</p>
      </PhanThuGon>

      <PhanThuGon
        id="doiSoat"
        tieuDe="🔍 Đối soát tờ khai ↔ hoá đơn"
        phu={`${doiSoat.filter((q) => [q.ban, q.mua].some((c) => c.lech !== null && Math.abs(c.lech) > 1000)).length} quý có lệch`}
        dong={dong}
        setDong={setDong}
      >
        <DoiSoat ds={doiSoat} />
      </PhanThuGon>

      <PhanThuGon
        id="khachHang"
        tieuDe="👥 Khách hàng (bán ra)"
        phu={<span className="flex items-center gap-2">{dt.ban.length} khách · {trieu(dt.tongBan)} {chonNamDT}</span>}
        dong={dong}
        setDong={setDong}
      >
        <BangDoiTac ds={dt.ban} tong={dt.tongBan} loai="ban" nguonQuy={dt.nguonQuy} />
      </PhanThuGon>

      <PhanThuGon
        id="nhaCungCap"
        tieuDe="🏭 Nhà cung cấp (mua vào)"
        phu={<span className="flex items-center gap-2">{dt.mua.length} nhà cung cấp · {trieu(dt.tongMua)} {chonNamDT}</span>}
        dong={dong}
        setDong={setDong}
      >
        <BangDoiTac ds={dt.mua} tong={dt.tongMua} loai="mua" nguonQuy={dt.nguonQuy} />
      </PhanThuGon>

      {tq.chungTu.length > 0 && (
        <PhanThuGon id="chungTu" tieuDe="Chứng từ nộp tiền vào ngân sách" phu={`${tq.chungTu.length} chứng từ`} dong={dong} setDong={setDong}>
          <ul className="space-y-1 text-sm">
            {tq.chungTu.map((c) => (
              <li key={c.so}>
                {c.ngay} — <b className="tabular-nums">{tien(c.tong)} đ</b> — {c.dong.map((d) => `${tenTieuMuc(d.ndkt)} kỳ ${d.kyThue.replace(/^00\//, '')}`).join('; ')} <span className="text-slate-400">(số {c.so})</span>
              </li>
            ))}
          </ul>
        </PhanThuGon>
      )}

      {tq.khac.length > 0 && (
        <PhanThuGon id="khac" tieuDe="Tờ khai / báo cáo khác đã lưu" phu={`${tq.khac.length} tờ`} dong={dong} setDong={setDong}>
          <ul className="space-y-1 text-sm">
            {tq.khac.map((t, i) => (
              <li key={i}>{t.tenTKhai || `Mẫu mã ${t.maTKhai}`} — kỳ {t.ky}{t.loaiTKhai === 'B' ? ` (bổ sung ${t.soLan})` : ''} <span className="text-slate-400">({t.tenFile})</span></li>
            ))}
          </ul>
        </PhanThuGon>
      )}
    </div>
  )
}
