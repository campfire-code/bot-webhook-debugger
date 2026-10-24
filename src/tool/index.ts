// 工具声明：群机器人调试器（自定义界面）。请求只发往用户自己填写的企业微信 / 钉钉 / 飞书群机器人地址。
import { Bug } from 'lucide-react';
import { createElement } from 'react';
import type { CustomTool } from '../kit/types';
import { Main } from './Main';

const tool: CustomTool = {
  id: 'w17',
  name: '群机器人调试器',
  tagline: '钉钉、飞书、企微机器人消息统一调试',
  icon: Bug,
  category: '微信私域',
  type: 'text',
  mode: 'custom',
  mainLabel: '调试',
  needsLLM: false,
  params: [],
  Main: ({ ctx }) => createElement(Main, { ctx }),
};

export default tool;
