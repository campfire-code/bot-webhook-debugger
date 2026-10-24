// 截图与预览用的示例数据（不会进入正式运行）。地址、密钥、群均为虚构占位，没有发送任何消息。
import { explainResponse, maskUrl } from './platforms';
import type { SendResult } from './send';
import { DEMO_RESPONSE, DEMO_SECRET, DEMO_WEBHOOK, sampleHistory } from './samples';
import type { DemoState } from './Main';

export const rows = () => [];
export const params = {};

const body = {
  msgtype: 'markdown',
  markdown: { title: '库存提醒', text: '#### 【示例】库存提醒\n> 商品：示例保温杯 500 毫升\n> 剩余库存：**12 件**' },
  at: { isAtAll: false },
};
const shownUrl = maskUrl(`${DEMO_WEBHOOK}&timestamp=1792749000000&sign=${encodeURIComponent('c2lnbi1leGFtcGxlLTAwMDAwMDAwMDAwMA==')}`);
const result: SendResult = {
  at: '2026-10-23T09:50:00Z', platform: 'dingtalk', shownUrl, requestBody: JSON.stringify(body), status: 200, ms: 186,
  responseText: DEMO_RESPONSE, explain: explainResponse('dingtalk', 200, DEMO_RESPONSE),
};

export const demo: DemoState = {
  platform: 'dingtalk',
  urls: { wecom: '', dingtalk: DEMO_WEBHOOK, feishu: '' },
  secrets: { wecom: '', dingtalk: DEMO_SECRET, feishu: '' },
  text: JSON.stringify(body, null, 2),
  result,
  history: sampleHistory(),
  notice: { kind: 'ok', text: '示例：这是虚构的示例数据，没有向任何群发送消息。' },
};
