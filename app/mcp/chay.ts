// Điểm khởi động: AI (Claude Code, Claude Desktop...) chạy file này và nói chuyện qua stdin/stdout.
// Không in gì ra stdout ngoài giao thức MCP — nhật ký (nếu có) phải ra stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { taoMayChu } from './mayChu.js'
import { nguonThuMuc } from './nguon.js'

await taoMayChu(nguonThuMuc()).connect(new StdioServerTransport())
console.error('khaithue MCP: sẵn sàng')
