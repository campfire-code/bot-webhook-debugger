import { describe, expect, it } from 'vitest';
import { addHistory, messageType, prepare, rateWarning, recentCount, toHistory, wecomImageBody, type HistoryEntry } from './core';
import { base64Size, fromBase64, md5 } from './crypto';
import { explainResponse } from './platforms';

const h = (platform: HistoryEntry['platform'], at: string): HistoryEntry => ({ at, platform, type: 'text', ok: true, summary: '', ms: 1 });

describe('prepare', () => {
  it('语法错给出行列', () => {
    const r = prepare('wecom', '{\n  "msgtype": "text",\n  "text": {,}\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.line).toBe(3); expect(r.syntax).not.toBe(''); }
  });
  it('合法消息通过', () => {
    const r = prepare('wecom', '{"msgtype":"text","text":{"content":"hi"}}');
    expect(r.ok).toBe(true);
  });
  it('校验错误让 ok 为 false 并带问题列表', () => {
    const r = prepare('dingtalk', '{"msgtype":"text","text":{}}');
    expect(r.ok).toBe(false);
    expect(r.issues[0].message).toContain('content');
  });
  it('平台选错：飞书的 msg_type 发给钉钉', () => {
    const r = prepare('dingtalk', '{"msg_type":"text","content":{"text":"x"}}');
    expect(r.issues[0].message).toContain('msgtype');
  });
  it('企微文本超过 2048 字节报错，刚好 2048 通过', () => {
    expect(prepare('wecom', JSON.stringify({ msgtype: 'text', text: { content: 'a'.repeat(2048) } })).ok).toBe(true);
    expect(prepare('wecom', JSON.stringify({ msgtype: 'text', text: { content: 'a'.repeat(2049) } })).ok).toBe(false);
    expect(prepare('wecom', JSON.stringify({ msgtype: 'text', text: { content: '汉'.repeat(683) } })).ok).toBe(false); // 2049 字节
  });
  it('飞书请求体超过 20KB 报错', () => {
    const r = prepare('feishu', JSON.stringify({ msg_type: 'text', content: { text: 'a'.repeat(21000) } }));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.message.includes('20 KB'))).toBe(true);
  });
});

describe('企业微信图片', () => {
  it('base64 与 md5 来自原始字节，且能通过校验', () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const b = wecomImageBody(bytes) as { image: { base64: string; md5: string } };
    expect(Array.from(fromBase64(b.image.base64))).toEqual(Array.from(bytes));
    expect(b.image.md5).toBe(md5(bytes));
    expect(base64Size(b.image.base64)).toBe(bytes.length);
    expect(prepare('wecom', JSON.stringify(b)).ok).toBe(true);
  });
  it('MD5 与已知值一致（RFC 1321 测试向量）', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('12345678901234567890123456789012345678901234567890123456789012345678901234567890')).toBe('57edf4a22be3c955ac49da2e2107b67a');
  });
});

describe('频率提醒', () => {
  const now = Date.parse('2026-10-23T10:00:00Z');
  it('只统计最近 60 秒、同平台', () => {
    const hist = [h('wecom', '2026-10-23T09:59:30Z'), h('wecom', '2026-10-23T09:58:00Z'), h('feishu', '2026-10-23T09:59:50Z')];
    expect(recentCount(hist, 'wecom', now)).toBe(1);
  });
  it('接近和超过上限给出提示', () => {
    const mk = (n: number) => Array.from({ length: n }, () => h('wecom', '2026-10-23T09:59:50Z'));
    expect(rateWarning(mk(3), 'wecom', now)).toBeNull();
    expect(rateWarning(mk(15), 'wecom', now)).toContain('接近');
    expect(rateWarning(mk(20), 'wecom', now)).toContain('限流');
    expect(rateWarning(mk(20), 'feishu', now)).toBeNull();
  });
});

describe('历史记录', () => {
  it('不含地址、密钥和消息内容，只保留 50 条', () => {
    const r = { at: '2026-10-23T10:00:00Z', platform: 'wecom' as const, shownUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=SECRET-KEY', requestBody: '{"secret":"x"}', status: 200, ms: 5, responseText: '{"errcode":93000,"errmsg":"invalid webhook url"}', explain: explainResponse('wecom', 200, '{"errcode":93000,"errmsg":"invalid webhook url"}') };
    const e = toHistory(r, 'text');
    expect(JSON.stringify(e)).not.toContain('SECRET-KEY');
    expect(JSON.stringify(e)).not.toContain('secret');
    expect(e.summary).toContain('93000');
    let list: HistoryEntry[] = [];
    for (let i = 0; i < 60; i++) list = addHistory(list, e);
    expect(list).toHaveLength(50);
  });
  it('messageType 按平台取字段', () => {
    expect(messageType('feishu', { msg_type: 'post' })).toBe('post');
    expect(messageType('wecom', {})).toBe('?');
  });
});
