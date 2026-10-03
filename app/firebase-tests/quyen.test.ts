// Kiểm LUẬT PHÂN QUYỀN Firestore + Storage trên máy giả lập (emulator).
// Chạy: npm run test:quyen   (cần Java + firebase-tools)

import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-khaithue',
    firestore: { rules: readFileSync('../firebase/firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
    storage: { rules: readFileSync('../firebase/storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  })
})
afterAll(async () => env?.cleanup())
beforeEach(async () => {
  await env.clearFirestore()
  await env.clearStorage()
})

const HO_SO = { hoSo: { mst: '0100000000', tenNNT: 'Cty A' } }

describe('Firestore: mỗi người chỉ thấy vùng của mình', () => {
  it('chủ đọc / ghi được hồ sơ của mình', async () => {
    const db = env.authenticatedContext('anh').firestore()
    await assertSucceeds(setDoc(doc(db, 'nguoiDung/anh/congTy/0100000000'), HO_SO))
    await assertSucceeds(getDoc(doc(db, 'nguoiDung/anh/congTy/0100000000')))
  })
  it('người khác KHÔNG đọc, KHÔNG ghi được', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'nguoiDung/anh/congTy/0100000000'), HO_SO) })
    const la = env.authenticatedContext('nguoi-la').firestore()
    await assertFails(getDoc(doc(la, 'nguoiDung/anh/congTy/0100000000')))
    await assertFails(setDoc(doc(la, 'nguoiDung/anh/congTy/0100000000'), HO_SO))
  })
  it('XOÁ: chủ xoá được; người khác KHÔNG xoá được', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'nguoiDung/anh/congTy/0100000000'), HO_SO) })
    await assertFails(deleteDoc(doc(env.authenticatedContext('nguoi-la').firestore(), 'nguoiDung/anh/congTy/0100000000')))
    await assertSucceeds(deleteDoc(doc(env.authenticatedContext('anh').firestore(), 'nguoiDung/anh/congTy/0100000000')))
  })
  it('chưa đăng nhập: cấm hết', async () => {
    const an = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(an, 'nguoiDung/anh/congTy/0100000000')))
    await assertFails(setDoc(doc(an, 'nguoiDung/anh/x/y'), { a: 1 }))
  })
  it('ngoài vùng nguoiDung: cấm hết, kể cả đã đăng nhập', async () => {
    const db = env.authenticatedContext('anh').firestore()
    await assertFails(setDoc(doc(db, 'chung/abc'), { a: 1 }))
  })
})

describe('Storage: file tờ khai / hoá đơn', () => {
  const tep = new TextEncoder().encode('<xml/>')
  it('chủ tải lên và tải về được', async () => {
    const st = env.authenticatedContext('anh').storage()
    await assertSucceeds(uploadBytes(ref(st, 'nguoiDung/anh/0100000000/toKhai/a.xml'), tep))
    await assertSucceeds(getBytes(ref(st, 'nguoiDung/anh/0100000000/toKhai/a.xml')))
  })
  it('người khác KHÔNG tải về / ghi đè được', async () => {
    await assertSucceeds(uploadBytes(ref(env.authenticatedContext('anh').storage(), 'nguoiDung/anh/0100000000/toKhai/a.xml'), tep))
    const la = env.authenticatedContext('nguoi-la').storage()
    await assertFails(getBytes(ref(la, 'nguoiDung/anh/0100000000/toKhai/a.xml')))
    await assertFails(uploadBytes(ref(la, 'nguoiDung/anh/0100000000/toKhai/a.xml'), tep))
  })
  it('XOÁ file: người khác không xoá được, chủ xoá được', async () => {
    const duong = 'nguoiDung/anh/0100000000/hoaDon/x.xlsx'
    await assertSucceeds(uploadBytes(ref(env.authenticatedContext('anh').storage(), duong), tep))
    await assertFails(deleteObject(ref(env.authenticatedContext('nguoi-la').storage(), duong)))
    await assertSucceeds(deleteObject(ref(env.authenticatedContext('anh').storage(), duong)))
  })
  it('chưa đăng nhập: cấm', async () => {
    await assertFails(uploadBytes(ref(env.unauthenticatedContext().storage(), 'nguoiDung/anh/x.xml'), tep))
  })
  it('file từ 10 MB trở lên: chặn', async () => {
    const to = new Uint8Array(10 * 1024 * 1024 + 1)
    await assertFails(uploadBytes(ref(env.authenticatedContext('anh').storage(), 'nguoiDung/anh/to.xlsx'), to))
  })
})
