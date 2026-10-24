// check-zh: 整个文件忽略（各平台群机器人消息的字段名和取值，用户要照着平台文档写进 JSON，不能翻译）
// 三个平台的群机器人：地址格式、消息模板、字段校验、返回码解释。
// 全部依据官方文档（2026-10-23 核实）：
// - 企业微信「群机器人配置说明」https://developer.work.weixin.qq.com/document/path/91770 ，全局错误码 https://developer.work.weixin.qq.com/document/path/90313
// - 钉钉「自定义机器人发送消息的消息类型」https://open.dingtalk.com/document/orgapp/custom-bot-send-message-type
//   「自定义机器人安全设置」https://open.dingtalk.com/document/orgapp/customize-robot-security-settings
//   「自定义机器人发送群聊消息」https://open.dingtalk.com/document/orgapp/custom-robots-send-group-messages
// - 飞书「自定义机器人使用指南」https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot

export type PlatformId = 'wecom' | 'dingtalk' | 'feishu';
export type Kind = 'text' | 'markdown' | 'image' | 'card';

export interface Platform {
  id: PlatformId;
  name: string;
  short: string;
  /** 地址示例（key 为明显的占位） */
  example: string;
  /** 消息类型字段名 */
  typeKey: 'msgtype' | 'msg_type';
  /** 安全设置里的签名叫法；企微群机器人没有签名 */
  signLabel?: string;
  signHelp?: string;
  /** 频率限制说明（官方文档原意） */
  rate: string;
  doc: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: 'wecom', name: '企业微信群机器人', short: '企业微信',
    example: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=00000000-0000-0000-0000-000000000000',
    typeKey: 'msgtype',
    rate: '每个机器人每分钟最多发 20 条',
    doc: 'https://developer.work.weixin.qq.com/document/path/91770',
  },
  {
    id: 'dingtalk', name: '钉钉自定义机器人', short: '钉钉',
    example: 'https://oapi.dingtalk.com/robot/send?access_token=0000000000000000000000000000000000000000000000000000000000000000',
    typeKey: 'msgtype',
    signLabel: '加签密钥', signHelp: '机器人安全设置里「加签」下面以 SEC 开头的字符串；没开加签就留空',
    rate: '每个机器人每分钟最多发 20 条，超过会限流 10 分钟',
    doc: 'https://open.dingtalk.com/document/orgapp/custom-bot-send-message-type',
  },
  {
    id: 'feishu', name: '飞书自定义机器人', short: '飞书',
    example: 'https://open.feishu.cn/open-apis/bot/v2/hook/00000000-0000-0000-0000-000000000000',
    typeKey: 'msg_type',
    signLabel: '签名校验密钥', signHelp: '机器人安全设置里「签名校验」的密钥；没开签名校验就留空',
    rate: '每个机器人 100 次/分钟、5 次/秒；请求体不超过 20 KB',
    doc: 'https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot',
  },
];
export const platformOf = (id: string) => PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0];

export interface Template {
  id: string;
  platform: PlatformId;
  kind: Kind;
  label: string;
  body: Record<string, unknown>;
  note?: string;
}

const SAMPLE_URL = 'https://example.com/';
const SAMPLE_PIC = 'https://example.com/sample.png';

export const TEMPLATES: Template[] = [
  // ---- 企业微信 ----
  { id: 'wecom-text', platform: 'wecom', kind: 'text', label: '文本', body: { msgtype: 'text', text: { content: '【示例】今日 18:00 前请提交周报。', mentioned_list: ['@all'] } }, note: 'content 最长 2048 字节；mentioned_list 填成员 userid，@all 提醒所有人' },
  { id: 'wecom-markdown', platform: 'wecom', kind: 'markdown', label: 'markdown', body: { msgtype: 'markdown', markdown: { content: '### 【示例】库存提醒\n> 商品：<font color="warning">示例保温杯 500 毫升</font>\n> 剩余库存：<font color="comment">12 件</font>\n\n[查看详情](https://example.com/)' } }, note: 'content 最长 4096 字节；字体颜色只支持 info（绿）、comment（灰）、warning（橙红）' },
  { id: 'wecom-markdown-v2', platform: 'wecom', kind: 'markdown', label: 'markdown_v2', body: { msgtype: 'markdown_v2', markdown_v2: { content: '# 【示例】周报提醒\n**截止时间**：周五 18:00\n\n- 本周完成\n- 下周计划' } }, note: 'content 最长 4096 字节；不支持字体颜色和 @ 群成员，客户端版本过低会显示为纯文本' },
  { id: 'wecom-image', platform: 'wecom', kind: 'image', label: '图片', body: { msgtype: 'image', image: { base64: '', md5: '' } }, note: '点「选图片」自动填 base64 和 md5；图片编码前不超过 2M，支持 JPG、PNG' },
  { id: 'wecom-news', platform: 'wecom', kind: 'card', label: '图文 news', body: { msgtype: 'news', news: { articles: [{ title: '【示例】十月活动安排', description: '点击查看活动时间和报名方式', url: SAMPLE_URL, picurl: SAMPLE_PIC }] } }, note: '一条消息 1～8 篇图文；title 超过 128 字节、description 超过 512 字节会被截断' },
  { id: 'wecom-card', platform: 'wecom', kind: 'card', label: '模板卡片 文本通知', body: { msgtype: 'template_card', template_card: { card_type: 'text_notice', main_title: { title: '【示例】审批提醒', desc: '你有 3 条待审批' }, card_action: { type: 1, url: SAMPLE_URL } } }, note: 'main_title.title 与 sub_title_text 至少填一个；card_action.type 为 1 跳转链接（填 url）、2 打开小程序（填 appid）' },
  // ---- 钉钉 ----
  { id: 'dingtalk-text', platform: 'dingtalk', kind: 'text', label: '文本', body: { msgtype: 'text', text: { content: '【示例】今日 18:00 前请提交周报。' }, at: { atMobiles: [], atUserIds: [], isAtAll: false } }, note: '要 @ 人时，content 里也要写上 @手机号 或 @userId' },
  { id: 'dingtalk-markdown', platform: 'dingtalk', kind: 'markdown', label: 'markdown', body: { msgtype: 'markdown', markdown: { title: '库存提醒', text: '#### 【示例】库存提醒\n> 商品：示例保温杯 500 毫升\n> 剩余库存：**12 件**' }, at: { isAtAll: false } }, note: 'title 是会话列表里显示的文字；markdown 只支持部分语法' },
  { id: 'dingtalk-image', platform: 'dingtalk', kind: 'image', label: '图片（markdown 内嵌）', body: { msgtype: 'markdown', markdown: { title: '示例图片', text: `#### 【示例】今日海报\n![海报](${SAMPLE_PIC})` } }, note: '钉钉自定义机器人没有单独的图片类型，用 markdown 的 ![](图片地址) 发图（官方建议一条不超过 20 张）' },
  { id: 'dingtalk-link', platform: 'dingtalk', kind: 'card', label: '链接 link', body: { msgtype: 'link', link: { title: '【示例】十月活动安排', text: '点击查看活动时间和报名方式', messageUrl: SAMPLE_URL, picUrl: '' } }, note: 'link 消息不支持 @ 人' },
  { id: 'dingtalk-actioncard', platform: 'dingtalk', kind: 'card', label: '整体跳转 ActionCard', body: { msgtype: 'actionCard', actionCard: { title: '审批提醒', text: '### 【示例】审批提醒\n你有 3 条待审批', btnOrientation: '0', singleTitle: '去处理', singleURL: SAMPLE_URL } } },
  { id: 'dingtalk-actioncard-btns', platform: 'dingtalk', kind: 'card', label: '独立跳转 ActionCard', body: { msgtype: 'actionCard', actionCard: { title: '活动报名', text: '### 【示例】周末活动报名\n请选择是否参加', btnOrientation: '1', btns: [{ title: '参加', actionURL: SAMPLE_URL }, { title: '不参加', actionURL: SAMPLE_URL }] } } },
  { id: 'dingtalk-feedcard', platform: 'dingtalk', kind: 'card', label: 'FeedCard', body: { msgtype: 'feedCard', feedCard: { links: [{ title: '【示例】新品上架', messageURL: SAMPLE_URL, picURL: SAMPLE_PIC }, { title: '【示例】会员日安排', messageURL: SAMPLE_URL, picURL: SAMPLE_PIC }] } }, note: 'FeedCard 不支持 @ 人' },
  // ---- 飞书 ----
  { id: 'feishu-text', platform: 'feishu', kind: 'text', label: '文本', body: { msg_type: 'text', content: { text: '【示例】今日 18:00 前请提交周报。<at user_id="all">所有人</at>' } }, note: '@ 所有人写 <at user_id="all">所有人</at>，群需要开启 @所有人' },
  { id: 'feishu-post', platform: 'feishu', kind: 'markdown', label: '富文本 post', body: { msg_type: 'post', content: { post: { zh_cn: { title: '【示例】项目更新通知', content: [[{ tag: 'text', text: '项目有更新：' }, { tag: 'a', text: '请查看', href: SAMPLE_URL }]] } } } }, note: '飞书自定义机器人没有 markdown 类型，富文本用 post；卡片里可以用 markdown 组件' },
  { id: 'feishu-image', platform: 'feishu', kind: 'image', label: '图片', body: { msg_type: 'image', content: { image_key: 'img_示例_需要先通过上传图片接口获取' } }, note: 'image_key 要先通过飞书「上传图片」接口获取，本工具不负责上传' },
  { id: 'feishu-card', platform: 'feishu', kind: 'card', label: '卡片 interactive', body: { msg_type: 'interactive', card: { schema: '2.0', header: { title: { tag: 'plain_text', content: '【示例】库存提醒' }, template: 'blue' }, body: { elements: [{ tag: 'markdown', content: '商品：示例保温杯 500 毫升\n剩余库存：**12 件**' }, { tag: 'button', text: { tag: 'plain_text', content: '查看详情' }, type: 'default', behaviors: [{ type: 'open_url', default_url: SAMPLE_URL }] }] } } }, note: '卡片放在 card 字段（不是 content）；自定义机器人的卡片只支持按钮、文字链跳转链接，不支持回调' },
];

export const templatesOf = (p: PlatformId) => TEMPLATES.filter((t) => t.platform === p);
export const KIND_LABEL: Record<Kind, string> = { text: '文本', markdown: 'markdown', image: '图片', card: '卡片' };

// ---------- 地址 ----------

export interface UrlCheck {
  ok: boolean;
  error?: string;
  /** 地址看起来属于另一个平台 */
  other?: PlatformId;
}

const RULES: Record<PlatformId, { host: string; path: RegExp; param?: string; what: string }> = {
  wecom: { host: 'qyapi.weixin.qq.com', path: /^\/cgi-bin\/webhook\/send$/, param: 'key', what: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…' },
  dingtalk: { host: 'oapi.dingtalk.com', path: /^\/robot\/send$/, param: 'access_token', what: 'https://oapi.dingtalk.com/robot/send?access_token=…' },
  feishu: { host: 'open.feishu.cn', path: /^\/open-apis\/bot\/v2\/hook\/[^/]+$/, what: 'https://open.feishu.cn/open-apis/bot/v2/hook/…' },
};

export function detectPlatform(url: string): PlatformId | null {
  try {
    const host = new URL(url.trim()).hostname;
    return (Object.keys(RULES) as PlatformId[]).find((k) => RULES[k].host === host) ?? null;
  } catch {
    return null;
  }
}

export function checkWebhook(p: PlatformId, raw: string): UrlCheck {
  const s = raw.trim();
  if (!s) return { ok: false, error: '还没有填机器人地址' };
  if (/\s/.test(s)) return { ok: false, error: '地址里有空格或换行，复制时可能多带了内容' };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { ok: false, error: '不是有效的网址，应以 https:// 开头' };
  }
  const r = RULES[p];
  const other = detectPlatform(s);
  if (other && other !== p) return { ok: false, error: `这是${platformOf(other).short}的地址，当前选的是${platformOf(p).short}`, other };
  if (u.protocol !== 'https:') return { ok: false, error: '地址要以 https:// 开头' };
  if (u.hostname !== r.host) return { ok: false, error: `${platformOf(p).short}机器人的地址格式是 ${r.what}` };
  if (!r.path.test(u.pathname)) return { ok: false, error: `路径不对，格式应为 ${r.what}` };
  if (r.param && !u.searchParams.get(r.param)) return { ok: false, error: `地址里缺少 ${r.param} 参数，格式应为 ${r.what}` };
  return { ok: true };
}

/** 打码显示：只留前 4 位和后 4 位 */
export function maskToken(t: string): string {
  if (t.length <= 8) return '****';
  return `${t.slice(0, 4)}****${t.slice(-4)}`;
}

/** 把地址里的密钥类参数打码（key、access_token、飞书 hook id、sign） */
export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of ['key', 'access_token', 'sign']) {
      const v = u.searchParams.get(k);
      if (v) u.searchParams.set(k, maskToken(v));
    }
    u.pathname = u.pathname.replace(/(\/hook\/)([^/]+)$/, (_, a: string, id: string) => a + maskToken(id));
    return decodeURI(u.toString());
  } catch {
    return url.length > 16 ? url.slice(0, 12) + '****' : '****';
  }
}

// ---------- 消息校验 ----------

export interface Issue {
  level: 'error' | 'warn';
  path: string;
  message: string;
}

const enc = new TextEncoder();
export const byteLen = (s: string) => enc.encode(s).length;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim() !== '';

class Checker {
  issues: Issue[] = [];
  err(path: string, message: string) { this.issues.push({ level: 'error', path, message }); }
  warn(path: string, message: string) { this.issues.push({ level: 'warn', path, message }); }
  /** 取对象字段，不存在或类型不对就报错 */
  obj(o: Obj, key: string, path: string): Obj | null {
    const v = o[key];
    if (!isObj(v)) { this.err(path ? `${path}.${key}` : key, v === undefined ? `缺少必填字段 ${key}（对象）` : `${key} 应该是对象 {…}`); return null; }
    return v;
  }
  str(o: Obj, key: string, path: string, opt: { maxBytes?: number; warnBytes?: number; optional?: boolean } = {}): string | null {
    const v = o[key];
    const p = path ? `${path}.${key}` : key;
    if (v === undefined || v === null || v === '') { if (!opt.optional) this.err(p, `缺少必填字段 ${key}`); return null; }
    if (typeof v !== 'string') { this.err(p, `${key} 应该是字符串`); return null; }
    if (!opt.optional && !v.trim()) { this.err(p, `${key} 不能为空`); return null; }
    const n = byteLen(v);
    if (opt.maxBytes && n > opt.maxBytes) this.err(p, `${key} 有 ${n} 字节，超过上限 ${opt.maxBytes} 字节（UTF-8，一个汉字 3 字节）`);
    if (opt.warnBytes && n > opt.warnBytes) this.warn(p, `${key} 有 ${n} 字节，超过 ${opt.warnBytes} 字节的部分会被截断`);
    return v;
  }
  arr(o: Obj, key: string, path: string, optional = false): unknown[] | null {
    const v = o[key];
    const p = path ? `${path}.${key}` : key;
    if (v === undefined) { if (!optional) this.err(p, `缺少必填字段 ${key}（数组）`); return null; }
    if (!Array.isArray(v)) { this.err(p, `${key} 应该是数组 […]`); return null; }
    return v;
  }
  url(o: Obj, key: string, path: string, optional = false) {
    const v = this.str(o, key, path, { optional });
    if (v && !/^https?:\/\/\S+$/i.test(v.trim())) this.warn(`${path}.${key}`, `${key} 看起来不是网址（应以 http:// 或 https:// 开头）`);
  }
  strList(o: Obj, key: string, path: string) {
    const v = this.arr(o, key, path, true);
    if (v && v.some((x) => typeof x !== 'string')) this.err(`${path}.${key}`, `${key} 里每一项都应该是字符串`);
  }
}

const WECOM_TYPES = ['text', 'markdown', 'markdown_v2', 'image', 'news', 'file', 'voice', 'template_card'];
const DING_TYPES = ['text', 'link', 'markdown', 'actionCard', 'feedCard'];
const FEISHU_TYPES = ['text', 'post', 'image', 'share_chat', 'interactive'];
export const IMAGE_MAX = 2 * 1024 * 1024;
export const FEISHU_BODY_MAX = 20 * 1024;

function wecom(c: Checker, m: Obj, type: string, base64Size: (s: string) => number) {
  if (type === 'text') {
    const t = c.obj(m, 'text', '');
    if (!t) return;
    c.str(t, 'content', 'text', { maxBytes: 2048 });
    c.strList(t, 'mentioned_list', 'text');
    c.strList(t, 'mentioned_mobile_list', 'text');
  } else if (type === 'markdown' || type === 'markdown_v2') {
    const t = c.obj(m, type, '');
    if (!t) return;
    const s = c.str(t, 'content', type, { maxBytes: 4096 });
    if (s && type === 'markdown_v2' && /<font\s/i.test(s)) c.warn(`${type}.content`, 'markdown_v2 不支持字体颜色，<font> 会原样显示');
  } else if (type === 'image') {
    const t = c.obj(m, 'image', '');
    if (!t) return;
    const b = c.str(t, 'base64', 'image');
    const md = c.str(t, 'md5', 'image');
    if (md && !/^[0-9a-fA-F]{32}$/.test(md.trim())) c.err('image.md5', 'md5 应该是 32 位十六进制');
    if (b) {
      if (/^data:/i.test(b)) c.err('image.base64', '只填 base64 内容，不要带 data:image/...;base64, 前缀');
      else if (!/^[A-Za-z0-9+/\s]+={0,2}$/.test(b)) c.err('image.base64', 'base64 里有不合法的字符');
      else if (base64Size(b) > IMAGE_MAX) c.err('image.base64', `图片 ${(base64Size(b) / 1048576).toFixed(2)} MB，超过 2 MB 上限`);
    }
  } else if (type === 'news') {
    const n = c.obj(m, 'news', '');
    if (!n) return;
    const list = c.arr(n, 'articles', 'news');
    if (!list) return;
    if (list.length < 1 || list.length > 8) c.err('news.articles', `图文要 1～8 篇，现在是 ${list.length} 篇`);
    list.forEach((a, i) => {
      const p = `news.articles[${i}]`;
      if (!isObj(a)) return c.err(p, '每篇图文应该是对象');
      c.str(a, 'title', p, { warnBytes: 128 });
      c.str(a, 'description', p, { warnBytes: 512, optional: true });
      c.url(a, 'url', p);
      c.url(a, 'picurl', p, true);
    });
  } else if (type === 'file' || type === 'voice') {
    const t = c.obj(m, type, '');
    if (t) c.str(t, 'media_id', type);
  } else if (type === 'template_card') {
    const t = c.obj(m, 'template_card', '');
    if (!t) return;
    const ct = c.str(t, 'card_type', 'template_card');
    if (ct && ct !== 'text_notice' && ct !== 'news_notice') return c.err('template_card.card_type', 'card_type 只能是 text_notice（文本通知）或 news_notice（图文展示）');
    if (ct === 'news_notice') return c.warn('template_card', '图文展示卡片只检查了 card_type，其他字段以企业微信文档为准');
    if (ct !== 'text_notice') return;
    const mt = isObj(t.main_title) ? t.main_title : null;
    if (!nonEmpty(mt?.title) && !nonEmpty(t.sub_title_text)) c.err('template_card.main_title', 'main_title.title 和 sub_title_text 至少要填一个');
    const act = c.obj(t, 'card_action', 'template_card');
    if (act) {
      if (act.type === 1) c.url(act, 'url', 'template_card.card_action');
      else if (act.type === 2) c.str(act, 'appid', 'template_card.card_action');
      else c.err('template_card.card_action.type', '文本通知卡片的 card_action.type 只能是 1（跳转链接）或 2（打开小程序），注意是数字不是字符串');
    }
  }
}

function dingtalk(c: Checker, m: Obj, type: string) {
  if (type === 'text') {
    const t = c.obj(m, 'text', '');
    if (t) c.str(t, 'content', 'text');
  } else if (type === 'link') {
    const t = c.obj(m, 'link', '');
    if (!t) return;
    c.str(t, 'title', 'link');
    c.str(t, 'text', 'link');
    c.url(t, 'messageUrl', 'link');
    c.url(t, 'picUrl', 'link', true);
    if (m.at !== undefined) c.warn('at', 'link 消息不支持 @ 人');
  } else if (type === 'markdown') {
    const t = c.obj(m, 'markdown', '');
    if (!t) return;
    c.str(t, 'title', 'markdown');
    c.str(t, 'text', 'markdown');
  } else if (type === 'actionCard') {
    const t = c.obj(m, 'actionCard', '');
    if (!t) return;
    c.str(t, 'title', 'actionCard');
    c.str(t, 'text', 'actionCard');
    if (t.btns !== undefined) {
      const btns = c.arr(t, 'btns', 'actionCard');
      if (btns && !btns.length) c.err('actionCard.btns', 'btns 至少要有一个按钮');
      btns?.forEach((b, i) => {
        const p = `actionCard.btns[${i}]`;
        if (!isObj(b)) return c.err(p, '每个按钮应该是对象');
        c.str(b, 'title', p);
        c.url(b, 'actionURL', p);
      });
    } else {
      c.str(t, 'singleTitle', 'actionCard');
      c.url(t, 'singleURL', 'actionCard');
    }
    if (t.btnOrientation !== undefined && t.btnOrientation !== '0' && t.btnOrientation !== '1') c.err('actionCard.btnOrientation', 'btnOrientation 只能是字符串 "0"（竖排）或 "1"（横排）');
  } else if (type === 'feedCard') {
    const t = c.obj(m, 'feedCard', '');
    if (!t) return;
    const links = c.arr(t, 'links', 'feedCard');
    if (links && !links.length) c.err('feedCard.links', 'links 至少要有一条');
    links?.forEach((l, i) => {
      const p = `feedCard.links[${i}]`;
      if (!isObj(l)) return c.err(p, '每条应该是对象');
      c.str(l, 'title', p);
      c.url(l, 'messageURL', p);
      c.url(l, 'picURL', p);
    });
    if (m.at !== undefined) c.warn('at', 'FeedCard 不支持 @ 人');
  }
  if (isObj(m.at)) {
    c.strList(m.at, 'atMobiles', 'at');
    c.strList(m.at, 'atUserIds', 'at');
    if (m.at.isAtAll !== undefined && typeof m.at.isAtAll !== 'boolean') c.err('at.isAtAll', 'isAtAll 应该是 true 或 false（不加引号）');
  }
}

function feishu(c: Checker, m: Obj, type: string) {
  if (type === 'interactive') {
    if (!isObj(m.card)) c.err('card', isObj(m.content) ? '卡片要放在 card 字段，不是 content' : '缺少必填字段 card（对象）');
    return;
  }
  const ct = c.obj(m, 'content', '');
  if (!ct) return;
  if (type === 'text') c.str(ct, 'text', 'content');
  else if (type === 'image') c.str(ct, 'image_key', 'content');
  else if (type === 'share_chat') c.str(ct, 'share_chat_id', 'content');
  else if (type === 'post') {
    const post = c.obj(ct, 'post', 'content');
    if (!post) return;
    const langs = ['zh_cn', 'en_us'].filter((k) => post[k] !== undefined);
    if (!langs.length) return c.err('content.post', 'post 里至少要有 zh_cn 或 en_us 其中一种语言');
    for (const l of langs) {
      const p = `content.post.${l}`;
      const lo = c.obj(post, l, 'content.post');
      if (!lo) continue;
      const paras = c.arr(lo, 'content', p);
      paras?.forEach((para, i) => {
        if (!Array.isArray(para)) return c.err(`${p}.content[${i}]`, '每个段落应该是数组 [ {…}, {…} ]');
        para.forEach((node, j) => {
          const np = `${p}.content[${i}][${j}]`;
          if (!isObj(node)) return c.err(np, '每个节点应该是对象');
          const tag = node.tag;
          if (tag === 'text') c.str(node, 'text', np);
          else if (tag === 'a') { c.str(node, 'text', np); c.url(node, 'href', np); }
          else if (tag === 'at') c.str(node, 'user_id', np);
          else if (tag === 'img') c.str(node, 'image_key', np);
          else c.warn(np, `tag「${String(tag)}」不在文档列出的 text / a / at / img 里，以飞书为准`);
        });
      });
    }
  }
}

/** 按平台检查消息体；签名字段（飞书 timestamp/sign）由发送时自动加，不必写在这里 */
export function validateMessage(p: PlatformId, msg: unknown, base64Size: (s: string) => number): Issue[] {
  const c = new Checker();
  if (!isObj(msg)) {
    c.err('', '消息体应该是一个 JSON 对象 {…}');
    return c.issues;
  }
  const pf = platformOf(p);
  const otherKey = pf.typeKey === 'msgtype' ? 'msg_type' : 'msgtype';
  const type = msg[pf.typeKey];
  if (type === undefined) {
    c.err(pf.typeKey, msg[otherKey] !== undefined ? `${pf.short}用的是 ${pf.typeKey}，不是 ${otherKey}（是不是选错了平台？）` : `缺少消息类型字段 ${pf.typeKey}`);
    return c.issues;
  }
  const types = p === 'wecom' ? WECOM_TYPES : p === 'dingtalk' ? DING_TYPES : FEISHU_TYPES;
  if (typeof type !== 'string' || !types.includes(type)) {
    c.err(pf.typeKey, `${pf.short}不支持「${String(type)}」，可选：${types.join('、')}（区分大小写）`);
    return c.issues;
  }
  if (p === 'wecom') wecom(c, msg, type, base64Size);
  else if (p === 'dingtalk') dingtalk(c, msg, type);
  else feishu(c, msg, type);
  if (p === 'feishu' && byteLen(JSON.stringify(msg)) > FEISHU_BODY_MAX) c.err('', `请求体超过 20 KB（现在 ${(byteLen(JSON.stringify(msg)) / 1024).toFixed(1)} KB）`);
  return c.issues;
}

// ---------- 返回码 ----------

const WECOM_CODES: Record<number, string> = {
  [-1]: '系统繁忙，建议稍候重试，重试不超过 3 次',
  40008: '不合法的 msgtype',
  40058: '不合法的参数：常见原因是请求体不是合法 JSON、参数值或数组个数超出限制、必填参数为空',
  44004: '文本消息的 content 为空',
  45009: '调用超过频率限制，等一会儿再发',
  93000: '机器人地址不合法，或者这个机器人已经被移出群',
  93004: '机器人被停用',
  93008: '不在群里',
};
const DING_CODES: Record<number, string> = {
  [-1]: '系统繁忙，请稍后重试',
  40035: '缺少参数 json，请补充消息内容',
  43004: '无效的 Content-Type 请求头',
  400013: '群已被解散',
  400101: 'access_token 不存在，检查地址是否复制完整',
  400102: '机器人已停用，请联系管理员启用',
  400105: '不支持的消息类型',
  400106: '机器人不存在，确认机器人还在群里',
  410100: '发送太快被限流，请降低发送速度',
  430101: '含有不安全的外链',
  430102: '含有不合适的文本',
  430103: '含有不合适的图片',
  430104: '含有不合适的内容',
};
const DING_SECURITY: [RegExp, string][] = [
  [/keywords not in content/i, '消息里没有包含机器人安全设置里的任何一个自定义关键词'],
  [/invalid timestamp/i, 'timestamp 无效：与当前时间相差超过 1 小时，检查电脑时间'],
  [/sign not match/i, '签名不匹配：检查加签密钥是否复制完整'],
  [/not in whitelist/i, '本机出口 IP 不在机器人的 IP 白名单里'],
];
const FEISHU_CODES: Record<number, string> = {
  9499: '请求体格式错误：对照消息类型示例检查格式，请求体不能超过 20 KB',
  11232: '触发限流，避开整点、半点高峰再发',
  19021: '签名校验失败：密钥不对，或时间戳与当前时间相差超过 1 小时',
  19022: '本机出口 IP 不在机器人的 IP 白名单里',
  19024: '消息里没有包含机器人安全设置里的任何一个自定义关键词',
};

export interface Explain {
  ok: boolean;
  code?: number;
  msg?: string;
  hint: string;
}

export function explainResponse(p: PlatformId, status: number, text: string): Explain {
  let data: Obj | null = null;
  try {
    const v = JSON.parse(text);
    if (isObj(v)) data = v;
  } catch {
    /* 不是 JSON */
  }
  const codeKey = p === 'feishu' ? 'code' : 'errcode';
  const msgKey = p === 'feishu' ? 'msg' : 'errmsg';
  const raw = data?.[codeKey] ?? (p === 'feishu' ? data?.StatusCode : undefined);
  const code = raw === undefined || raw === null || raw === '' ? undefined : Number(raw);
  const msg = data && typeof data[msgKey] === 'string' ? (data[msgKey] as string) : undefined;
  if (code === undefined || Number.isNaN(code)) {
    const http = status >= 200 && status < 300 ? '返回内容不是平台的标准格式' : `HTTP ${status}`;
    return { ok: false, hint: `${http}，看不出是否发送成功，请对照原始响应检查地址` };
  }
  if (code === 0) return { ok: true, code, msg, hint: '发送成功，去群里看看效果' };
  let hint: string | undefined;
  if (p === 'wecom') hint = WECOM_CODES[code];
  else if (p === 'dingtalk') hint = code === 310000 ? DING_SECURITY.find(([re]) => re.test(msg ?? ''))?.[1] ?? '安全设置校验没通过（关键词 / 加签 / IP 白名单）' : DING_CODES[code];
  else hint = FEISHU_CODES[code];
  return { ok: false, code, msg, hint: hint ?? '这个返回码不在常见列表里，请按 errmsg 到平台文档查询' };
}
