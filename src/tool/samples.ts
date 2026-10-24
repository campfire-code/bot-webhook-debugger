// 示例数据：截图和预览用。地址与密钥均为明显的占位值，不是真实机器人。
import { addHistory, toHistory, type HistoryEntry } from './core';
import { explainResponse } from './platforms';
import type { SendResult } from './send';

export const DEMO_WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=0000000000000000000000000000000000000000000000000000000000000000';
// check-zh: 忽略（钉钉加签密钥固定以 SEC 开头）
export const DEMO_SECRET = 'SEC示例占位密钥0000';

const mk = (platform: SendResult['platform'], at: string, status: number, body: string, type: string, ms: number): HistoryEntry =>
  toHistory({ at, platform, shownUrl: '', requestBody: '', status, ms, responseText: body, explain: explainResponse(platform, status, body) }, type);

export function sampleHistory(): HistoryEntry[] {
  let h: HistoryEntry[] = [];
  h = addHistory(h, mk('feishu', '2026-10-23T09:40:00Z', 200, '{"code":19024,"msg":"Key Words Not Found"}', 'text', 214));
  h = addHistory(h, mk('wecom', '2026-10-23T09:42:00Z', 200, '{"errcode":0,"errmsg":"ok"}', 'markdown', 168));
  h = addHistory(h, mk('dingtalk', '2026-10-23T09:45:00Z', 200, '{"errcode":310000,"errmsg":"sign not match, more: [https://open.dingtalk.com/document/robots/customize-robot-security-settings]"}', 'markdown', 242));
  return h;
}

export const DEMO_RESPONSE = '{"errcode":0,"errmsg":"ok"}';
