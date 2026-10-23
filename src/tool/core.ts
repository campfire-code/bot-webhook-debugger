// 纯函数：消息解析与校验的整合、发送频率提示、历史记录。不依赖界面和本机能力，便于单元测试。
import { base64Size, md5, toBase64 } from './crypto';
import { checkJson } from './jsoncheck';
import { platformOf, validateMessage, type Issue, type PlatformId } from './platforms';
import type { SendResult } from './send';

export type Prepared =
  | { ok: false; syntax: string; line: number; col: number; issues: Issue[] }
  | { ok: true; msg: Record<string, unknown>; issues: Issue[] };

/** 把文本框里的内容解析成消息体并按平台校验；语法错时给出行列 */
export function prepare(p: PlatformId, text: string): Prepared {
  const r = checkJson(text);
  if (!r.ok) return { ok: false, syntax: r.error.message, line: r.error.line, col: r.error.col, issues: [] };
  const issues = validateMessage(p, r.value, base64Size);
  const bad = issues.some((i) => i.level === 'error');
  if (bad || typeof r.value !== 'object' || r.value === null || Array.isArray(r.value)) {
    return { ok: false, syntax: '', line: 0, col: 0, issues };
  }
  return { ok: true, msg: r.value as Record<string, unknown>, issues };
}

/** 企业微信图片消息：base64 和 md5 都是图片原始字节算出来的 */
export function wecomImageBody(bytes: Uint8Array): Record<string, unknown> {
  return { msgtype: 'image', image: { base64: toBase64(bytes), md5: md5(bytes) } };
}

/** 各平台官方给出的每分钟上限（企微 20、钉钉 20、飞书 100）；钉钉数字以其文档为准，见 README */
export const RATE_PER_MIN: Record<PlatformId, number> = { wecom: 20, dingtalk: 20, feishu: 100 };

/** 最近 60 秒内本工具对该平台发出的条数（同一台电脑，仅作提醒，其他程序发的不在内） */
export function recentCount(history: HistoryEntry[], p: PlatformId, nowMs: number): number {
  return history.filter((h) => h.platform === p && nowMs - new Date(h.at).getTime() < 60_000 && nowMs >= new Date(h.at).getTime()).length;
}

export function rateWarning(history: HistoryEntry[], p: PlatformId, nowMs: number): string | null {
  const n = recentCount(history, p, nowMs);
  const max = RATE_PER_MIN[p];
  if (n + 1 > max) return `${platformOf(p).short}限制每分钟 ${max} 条，最近一分钟你已发 ${n} 条，再发会被限流`;
  if (n + 1 >= Math.ceil(max * 0.8)) return `最近一分钟已发 ${n} 条，接近${platformOf(p).short}每分钟 ${max} 条的上限`;
  return null;
}

/** 历史只记结果，不记地址、密钥和请求体 */
export interface HistoryEntry {
  at: string;
  platform: PlatformId;
  type: string;
  status?: number;
  ok: boolean;
  summary: string;
  ms: number;
}

export function toHistory(r: SendResult, type: string): HistoryEntry {
  const e = r.explain;
  return {
    at: r.at, platform: r.platform, type, status: r.status, ok: e.ok, ms: r.ms,
    summary: r.networkError ? '没有收到响应' : e.ok ? '发送成功' : `${e.code !== undefined ? `返回码 ${e.code}：` : ''}${e.hint}`,
  };
}

export const addHistory = (h: HistoryEntry[], e: HistoryEntry, max = 50) => [e, ...h].slice(0, max);

export function messageType(p: PlatformId, msg: Record<string, unknown>): string {
  const v = msg[platformOf(p).typeKey];
  return typeof v === 'string' ? v : '?';
}
