import { describe, expect, it } from 'vitest';
import { base64Size } from './crypto';
import { TEMPLATES, byteLen, checkWebhook, detectPlatform, explainResponse, maskUrl, validateMessage } from './platforms';

describe('模板自检', () => {
  it('除需要用户补内容的图片模板外，每个模板都通过自己平台的校验（无错误）', () => {
    for (const t of TEMPLATES) {
      if (t.id === 'wecom-image') continue;
      const errs = validateMessage(t.platform, t.body, base64Size).filter((i) => i.level === 'error');
      expect(errs, t.id).toEqual([]);
    }
  });
  it('企微图片模板未选图片时提示缺 base64 / md5', () => {
    const t = TEMPLATES.find((x) => x.id === 'wecom-image')!;
    expect(validateMessage('wecom', t.body, base64Size).filter((i) => i.level === 'error').length).toBeGreaterThan(0);
  });
});

describe('地址检查', () => {
  it('三个平台的示例地址格式通过', () => {
    expect(checkWebhook('wecom', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc').ok).toBe(true);
    expect(checkWebhook('dingtalk', 'https://oapi.dingtalk.com/robot/send?access_token=abc').ok).toBe(true);
    expect(checkWebhook('feishu', 'https://open.feishu.cn/open-apis/bot/v2/hook/abc').ok).toBe(true);
  });
  it('常见错误：空、带空格、http、缺参数、选错平台', () => {
    expect(checkWebhook('wecom', '').error).toContain('还没有填');
    expect(checkWebhook('wecom', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a b').error).toContain('空格');
    expect(checkWebhook('wecom', 'http://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a').ok).toBe(false);
    expect(checkWebhook('dingtalk', 'https://oapi.dingtalk.com/robot/send').error).toContain('access_token');
    const r = checkWebhook('wecom', 'https://open.feishu.cn/open-apis/bot/v2/hook/abc');
    expect(r).toMatchObject({ ok: false, other: 'feishu' });
    expect(detectPlatform('https://example.com/x')).toBeNull();
  });
  it('打码：不泄露完整密钥', () => {
    const m = maskUrl('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=11112222-3333-4444-5555-666677778888');
    expect(m).toContain('1111****8888');
    expect(m).not.toContain('2222-3333');
    expect(maskUrl('https://open.feishu.cn/open-apis/bot/v2/hook/aaaabbbb-cccc-dddd-eeee-ffff00001111')).toContain('aaaa****1111');
  });
});

describe('消息校验边界', () => {
  const ok = (p: Parameters<typeof validateMessage>[0], m: unknown) => validateMessage(p, m, base64Size).filter((i) => i.level === 'error');
  it('企微 markdown 4096 字节边界、news 最多 8 篇', () => {
    expect(ok('wecom', { msgtype: 'markdown', markdown: { content: 'a'.repeat(4096) } })).toEqual([]);
    expect(ok('wecom', { msgtype: 'markdown', markdown: { content: 'a'.repeat(4097) } })).toHaveLength(1);
    const art = { title: 't', url: 'https://example.com/' };
    expect(ok('wecom', { msgtype: 'news', news: { articles: Array(8).fill(art) } })).toEqual([]);
    expect(ok('wecom', { msgtype: 'news', news: { articles: Array(9).fill(art) } })).toHaveLength(1);
  });
  it('企微图片带 data: 前缀、md5 长度不对都报错', () => {
    const e = ok('wecom', { msgtype: 'image', image: { base64: 'data:image/png;base64,AAAA', md5: 'abc' } });
    expect(e.map((x) => x.path).sort()).toEqual(['image.base64', 'image.md5']);
  });
  it('钉钉：btnOrientation 必须是字符串、isAtAll 必须是布尔、link 不支持 at', () => {
    expect(ok('dingtalk', { msgtype: 'actionCard', actionCard: { title: 'a', text: 'b', singleTitle: 'c', singleURL: 'https://e.com', btnOrientation: 0 } })).toHaveLength(1);
    expect(ok('dingtalk', { msgtype: 'text', text: { content: 'a' }, at: { isAtAll: 'true' } })).toHaveLength(1);
    const w = validateMessage('dingtalk', { msgtype: 'link', link: { title: 'a', text: 'b', messageUrl: 'https://e.com' }, at: {} }, base64Size);
    expect(w.some((i) => i.level === 'warn' && i.path === 'at')).toBe(true);
  });
  it('飞书：卡片必须放 card；不支持的类型列出可选值', () => {
    expect(ok('feishu', { msg_type: 'interactive', content: {} })[0].message).toContain('card');
    expect(ok('feishu', { msg_type: 'markdown', content: {} })[0].message).toContain('post');
  });
  it('byteLen 按 UTF-8 计算', () => {
    expect(byteLen('汉a')).toBe(4);
  });
});

describe('返回码解释（用录制的响应）', () => {
  it('成功', () => {
    expect(explainResponse('wecom', 200, '{"errcode":0,"errmsg":"ok"}')).toMatchObject({ ok: true, code: 0 });
    expect(explainResponse('feishu', 200, '{"StatusCode":0,"StatusMessage":"success","code":0,"msg":"success"}').ok).toBe(true);
  });
  it('飞书 19021 / 19022 / 19024 / 11232 / 9499', () => {
    expect(explainResponse('feishu', 200, '{"code":19021,"msg":"sign match fail or timestamp is not within one hour from current time"}').hint).toContain('签名');
    expect(explainResponse('feishu', 200, '{"code":19022,"msg":"Ip Not Allowed"}').hint).toContain('白名单');
    expect(explainResponse('feishu', 200, '{"code":19024,"msg":"Key Words Not Found"}').hint).toContain('关键词');
    expect(explainResponse('feishu', 200, '{"code":11232,"msg":"rate limited"}').hint).toContain('限流');
    expect(explainResponse('feishu', 400, '{"code":9499,"msg":"Bad Request"}').hint).toContain('20 KB');
  });
  it('钉钉 310000 按 errmsg 细分', () => {
    const r = (m: string) => explainResponse('dingtalk', 200, JSON.stringify({ errcode: 310000, errmsg: m })).hint;
    expect(r('keywords not in content, more: [x]')).toContain('关键词');
    expect(r('sign not match, more: [x]')).toContain('签名');
    expect(r('invalid timestamp')).toContain('timestamp');
    expect(r('ip 1.2.3.4 not in whitelist')).toContain('白名单');
  });
  it('未知返回码和非 JSON 响应不编造原因', () => {
    expect(explainResponse('wecom', 200, '{"errcode":12345,"errmsg":"x"}').hint).toContain('不在常见列表');
    const r = explainResponse('dingtalk', 502, '<html>Bad Gateway</html>');
    expect(r.ok).toBe(false);
    expect(r.hint).toContain('HTTP 502');
  });
});
