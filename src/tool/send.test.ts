import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { dingtalkSign, feishuSign } from './crypto';
import { buildRequest, prettyResponse, send, shownBody, type FetchLike } from './send';

const WECOM = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=11112222-3333-4444-5555-666677778888';
const DING = 'https://oapi.dingtalk.com/robot/send?access_token=aaaabbbbccccddddeeeeffff00001111';
const FEISHU = 'https://open.feishu.cn/open-apis/bot/v2/hook/aaaabbbb-cccc-dddd-eeee-ffff00001111';
const NOW = Date.UTC(2026, 9, 23, 10, 0, 0);

const fake = (status: number, body: string) => {
  const calls: { url: string; body: string; headers: Record<string, string> }[] = [];
  const f: FetchLike = async (url, init) => { calls.push({ url, body: init.body, headers: init.headers }); return { status, text: async () => body }; };
  return { f, calls };
};

describe('签名（与 node:crypto 独立对照）', () => {
  it('钉钉：HmacSHA256(key=secret, data=timestamp\\nsecret) 的 Base64', async () => {
    const expected = createHmac('sha256', 'SECabc').update(`${NOW}\nSECabc`).digest('base64');
    expect(await dingtalkSign('SECabc', NOW)).toBe(expected);
  });
  it('飞书：HmacSHA256(key=秒级timestamp\\nsecret, data=空串) 的 Base64', async () => {
    const sec = Math.floor(NOW / 1000);
    const expected = createHmac('sha256', `${sec}\nabc`).update('').digest('base64');
    expect(await feishuSign('abc', sec)).toBe(expected);
  });
});

describe('buildRequest', () => {
  it('企微不加任何签名', async () => {
    const r = await buildRequest('wecom', WECOM, { msgtype: 'text' }, 'ignored', NOW);
    expect(r.url).toBe(WECOM);
    expect(r.timestamp).toBeUndefined();
  });
  it('钉钉加签：地址追加 timestamp 与 URL 编码后的 sign，原有的会被替换', async () => {
    const r = await buildRequest('dingtalk', `${DING}&timestamp=1&sign=old`, { msgtype: 'text' }, 'SECabc', NOW);
    const u = new URL(r.url);
    expect(u.searchParams.get('timestamp')).toBe(String(NOW));
    expect(u.searchParams.get('sign')).toBe(await dingtalkSign('SECabc', NOW));
    expect(r.url).toContain('sign=' + encodeURIComponent(await dingtalkSign('SECabc', NOW)));
    expect(r.shownUrl).not.toContain(await dingtalkSign('SECabc', NOW));
    expect(r.shownUrl).not.toContain('aaaabbbbccccddddeeeeffff00001111');
  });
  it('钉钉没填密钥就不加签', async () => {
    expect((await buildRequest('dingtalk', DING, { msgtype: 'text' }, '  ', NOW)).url).toBe(DING);
  });
  it('飞书加签：timestamp、sign 放进请求体最前面', async () => {
    const r = await buildRequest('feishu', FEISHU, { msg_type: 'text', content: { text: 'x' } }, 'abc', NOW);
    const b = JSON.parse(r.body);
    expect(b.timestamp).toBe(String(Math.floor(NOW / 1000)));
    expect(b.sign).toBe(await feishuSign('abc', Math.floor(NOW / 1000)));
    expect(Object.keys(b)[0]).toBe('timestamp');
    expect(shownBody(r.body)).not.toContain(b.sign);
  });
});

describe('send（假的网络请求 + 录制响应）', () => {
  it('企微成功响应', async () => {
    const { f, calls } = fake(200, '{"errcode":0,"errmsg":"ok"}');
    const req = await buildRequest('wecom', WECOM, { msgtype: 'text', text: { content: 'hi' } }, '', NOW);
    let t = 1000;
    const r = await send(f, 'wecom', req, () => (t += 50));
    expect(calls).toHaveLength(1);
    expect(calls[0].headers['Content-Type']).toContain('application/json');
    expect(r).toMatchObject({ status: 200, ms: 50, explain: { ok: true } });
    expect(r.shownUrl).not.toContain('2222-3333');
  });
  it('钉钉安全设置失败（关键词）', async () => {
    const { f } = fake(200, '{"errcode":310000,"errmsg":"keywords not in content, more: [https://open.dingtalk.com/x]"}');
    const r = await send(f, 'dingtalk', await buildRequest('dingtalk', DING, { msgtype: 'text' }, '', NOW));
    expect(r.explain.ok).toBe(false);
    expect(r.explain.hint).toContain('关键词');
  });
  it('飞书签名失败的响应体，请求记录里的 sign 已打码', async () => {
    const { f } = fake(200, '{"code":19021,"msg":"sign match fail"}');
    const r = await send(f, 'feishu', await buildRequest('feishu', FEISHU, { msg_type: 'text', content: { text: 'x' } }, 'abc', NOW));
    expect(r.explain.code).toBe(19021);
    expect(r.requestBody).toContain('****');
    expect(r.requestBody).not.toContain(await feishuSign('abc', Math.floor(NOW / 1000)));
  });
  it('网络异常：返回中文提示且不含地址', async () => {
    const f: FetchLike = async () => { throw new Error('connect refused'); };
    const r = await send(f, 'wecom', await buildRequest('wecom', WECOM, { msgtype: 'text' }, '', NOW));
    expect(r.networkError).toBe('connect refused');
    expect(r.explain.hint).toContain('没有收到响应');
    expect(JSON.stringify(r)).not.toContain('2222-3333');
  });
  it('prettyResponse：JSON 缩进，非 JSON 原样', () => {
    expect(prettyResponse('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyResponse('<html>')).toBe('<html>');
  });
});
