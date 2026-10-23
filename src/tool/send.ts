// 组装请求（加签）并发送，记录原始响应。fetch 由调用方传入：应用里是 kit 的 httpFetch，测试里是录制好的假响应。
import { dingtalkSign, feishuSign } from './crypto';
import { explainResponse, maskUrl, type Explain, type PlatformId } from './platforms';

export interface BuiltRequest {
  url: string;
  /** 打码后的地址，用于显示 */
  shownUrl: string;
  body: string;
  /** 实际用的时间戳（加签时） */
  timestamp?: string;
}

/** now 为毫秒时间戳 */
export async function buildRequest(p: PlatformId, webhook: string, msg: Record<string, unknown>, secret: string, now: number): Promise<BuiltRequest> {
  const s = secret.trim();
  let url = webhook.trim();
  let body: Record<string, unknown> = msg;
  let timestamp: string | undefined;
  if (s && p === 'dingtalk') {
    timestamp = String(now);
    const sign = await dingtalkSign(s, now);
    const u = new URL(url);
    u.searchParams.delete('timestamp');
    u.searchParams.delete('sign');
    // sign 按官方要求 urlEncode；URLSearchParams 会把空格编成 +，这里手工拼
    url = `${u.toString()}&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`;
  } else if (s && p === 'feishu') {
    const sec = Math.floor(now / 1000);
    timestamp = String(sec);
    const { timestamp: _t, sign: _s, ...rest } = msg;
    body = { timestamp, sign: await feishuSign(s, sec), ...rest };
  }
  const json = JSON.stringify(body);
  const shownBody = p === 'feishu' && s ? json.replace(/("sign":")[^"]+/, (_, a: string) => a + '****') : json;
  return { url, shownUrl: maskUrl(url), body: shownBody === json ? json : json, timestamp };
}

/** 显示用请求体：飞书签名打码 */
export const shownBody = (body: string) => body.replace(/("sign":")([^"]+)/, (_, a: string, v: string) => a + (v.length > 8 ? v.slice(0, 4) + '****' : '****'));

export interface SendResult {
  at: string;
  platform: PlatformId;
  shownUrl: string;
  requestBody: string;
  status?: number;
  ms: number;
  responseText: string;
  explain: Explain;
  /** 网络层失败（没有收到响应） */
  networkError?: string;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ status: number; text(): Promise<string> }>;

export async function send(fetchFn: FetchLike, p: PlatformId, req: BuiltRequest, clock: () => number = Date.now, signal?: AbortSignal): Promise<SendResult> {
  const t0 = clock();
  const base = { at: new Date(t0).toISOString(), platform: p, shownUrl: req.shownUrl, requestBody: shownBody(req.body) };
  try {
    const res = await fetchFn(req.url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: req.body, signal });
    const text = await res.text();
    return { ...base, status: res.status, ms: clock() - t0, responseText: text, explain: explainResponse(p, res.status, text) };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ...base, ms: clock() - t0, responseText: '', networkError: m, explain: { ok: false, hint: `没有收到响应：${m}。检查网络、代理或地址是否正确` } };
  }
}

/** 把响应体排版成缩进 JSON（不是 JSON 就原样返回） */
export function prettyResponse(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
