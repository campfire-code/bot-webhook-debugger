// JSON 语法检查：自己扫一遍，给出出错的行、列和中文说明。
// 不同内核（WebView2 / WKWebView）的 JSON.parse 报错格式不一样，有的不带位置，所以不依赖它的报错文字。

export interface JsonError {
  offset: number;
  line: number;
  col: number;
  message: string;
}

export type JsonResult = { ok: true; value: unknown } | { ok: false; error: JsonError };

class Fail extends Error {
  constructor(public offset: number, message: string) {
    super(message);
  }
}

export function lineCol(text: string, offset: number): { line: number; col: number } {
  let line = 1, col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') { line++; col = 1; } else col++;
  }
  return { line, col };
}

const show = (ch: string | undefined) => (ch === undefined ? '文本结尾' : ch === '\n' ? '换行' : `「${ch}」`);

function scan(s: string) {
  let i = 0;
  const ws = () => { while (i < s.length && ' \t\n\r'.includes(s[i])) i++; };
  const value = (): void => {
    ws();
    const c = s[i];
    if (c === '{') return obj();
    if (c === '[') return arr();
    if (c === '"') return str();
    if (c === '-' || (c >= '0' && c <= '9')) return num();
    for (const w of ['true', 'false', 'null']) if (s.startsWith(w, i)) { i += w.length; return; }
    if (c === "'") throw new Fail(i, 'JSON 里的字符串要用英文双引号 "，不能用单引号');
    if (c === '“' || c === '”') throw new Fail(i, '这里是中文引号，JSON 要用英文双引号 "');
    if (c === undefined) throw new Fail(i, '内容不完整，缺少值');
    if (c === '}' || c === ']') throw new Fail(i, `这里缺少值，或者前一项后面多了逗号`);
    throw new Fail(i, `这里不应该出现${show(c)}，需要一个值（字符串要加双引号）`);
  };
  const obj = () => {
    i++;
    ws();
    if (s[i] === '}') { i++; return; }
    for (;;) {
      ws();
      if (s[i] === '}') throw new Fail(i, '最后一项后面多了逗号');
      if (s[i] !== '"') throw new Fail(i, s[i] === "'" ? '键名要用英文双引号 "，不能用单引号' : `这里需要用双引号包起来的键名，看到的是${show(s[i])}`);
      str();
      ws();
      if (s[i] !== ':') throw new Fail(i, s[i] === '：' ? '这里是中文冒号，要用英文冒号 :' : `键名后面缺少冒号 :`);
      i++;
      value();
      ws();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === '}') { i++; return; }
      if (s[i] === '，') throw new Fail(i, '这里是中文逗号，要用英文逗号 ,');
      throw new Fail(i, s[i] === undefined ? '缺少右花括号 }' : `这里缺少逗号 , 或右花括号 }，看到的是${show(s[i])}`);
    }
  };
  const arr = () => {
    i++;
    ws();
    if (s[i] === ']') { i++; return; }
    for (;;) {
      ws();
      if (s[i] === ']') throw new Fail(i, '最后一项后面多了逗号');
      value();
      ws();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === ']') { i++; return; }
      if (s[i] === '，') throw new Fail(i, '这里是中文逗号，要用英文逗号 ,');
      throw new Fail(i, s[i] === undefined ? '缺少右方括号 ]' : `这里缺少逗号 , 或右方括号 ]，看到的是${show(s[i])}`);
    }
  };
  const str = () => {
    const start = i;
    i++;
    while (i < s.length) {
      const c = s[i];
      if (c === '"') { i++; return; }
      if (c === '\n') throw new Fail(i, '字符串里不能直接换行，要写成 \\n');
      if (c === '\\') {
        const e = s[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) throw new Fail(i, '\\u 后面要跟 4 位十六进制数');
          i += 6;
          continue;
        }
        if (!e || !'"\\/bfnrt'.includes(e)) throw new Fail(i, `不认识的转义 \\${e ?? ''}，反斜杠本身要写成 \\\\`);
        i += 2;
        continue;
      }
      if (c < ' ') throw new Fail(i, '字符串里有控制字符（例如制表符），要写成转义形式 \\t');
      i++;
    }
    throw new Fail(start, '字符串没有结束，缺少右双引号 "');
  };
  const num = () => {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i));
    if (!m) throw new Fail(i, '数字格式不对');
    i += m[0].length;
  };
  value();
  ws();
  if (i < s.length) throw new Fail(i, `JSON 已经结束，后面多了${show(s[i])}`);
}

export function checkJson(text: string): JsonResult {
  if (!text.trim()) return { ok: false, error: { offset: 0, line: 1, col: 1, message: '内容是空的' } };
  try {
    scan(text);
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: { offset: e.offset, ...lineCol(text, e.offset), message: e.message } };
    throw e;
  }
  return { ok: true, value: JSON.parse(text) };
}
