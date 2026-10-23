import { describe, expect, it } from 'vitest';
import { checkJson } from './jsoncheck';

describe('checkJson', () => {
  it('合法 JSON', () => {
    expect(checkJson('{"a":[1,2,{"b":null}],"c":"汉\\n"}')).toMatchObject({ ok: true });
  });
  it('空内容', () => {
    expect(checkJson('  ')).toMatchObject({ ok: false });
  });
  it.each([
    ['末尾多逗号', '{"a":1,}'],
    ['单引号', "{'a':1}"],
    ['缺引号的键', '{a:1}'],
    ['后面多了内容', '{"a":1} x'],
    ['字符串没结束', '{"a":"x'],
    ['缺少逗号', '{"a":1 "b":2}'],
  ])('%s 报错并带行列', (_n, text) => {
    const r = checkJson(text);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.error.line).toBeGreaterThanOrEqual(1); expect(r.error.message).toBeTruthy(); }
  });
  it('行号按换行计算', () => {
    const r = checkJson('{\n"a":1,\n"b":\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(4);
  });
});
