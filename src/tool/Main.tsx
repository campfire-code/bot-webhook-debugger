// 机器人 Webhook 调试器：选平台 → 填地址 → 写消息（模板 / JSON）→ 校验 → 发送 → 看原始响应与中文解释。
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileImage, Loader2, Send, Wand2 } from 'lucide-react';
import type { RunContext } from '../kit/types';
import { httpFetch, openLink, pickFiles, settingsStore } from '../kit/platform';
import { CopyButton } from '../kit/parts';
import { addHistory, messageType, prepare, rateWarning, toHistory, wecomImageBody, type HistoryEntry } from './core';
import { PLATFORMS, checkWebhook, detectPlatform, platformOf, templatesOf, KIND_LABEL, type PlatformId } from './platforms';
import { buildRequest, prettyResponse, send, type FetchLike, type SendResult } from './send';
import './tool.css';

type Ctx = Pick<RunContext, 'readFile'>;
type Notice = { kind: 'ok' | 'err'; text: string } | null;
export interface DemoState {
  platform: PlatformId; urls: Record<PlatformId, string>; secrets: Record<PlatformId, string>;
  text: string; result: SendResult; history: HistoryEntry[]; notice?: Notice;
}
interface Saved { platform: PlatformId; urls: Record<PlatformId, string>; secrets: Record<PlatformId, string> }

const KEY = 'bot-webhook-debugger.config';
const HIST_KEY = 'bot-webhook-debugger.history';
const EMPTY_MAP: Record<PlatformId, string> = { wecom: '', dingtalk: '', feishu: '' };
const fmt = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getMonth() + 1}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const tplText = (id: string) => JSON.stringify(templatesOf(PLATFORMS.find((p) => id.startsWith(p.id))!.id).find((t) => t.id === id)!.body, null, 2);

/** 真实发送：Tauri HTTP 插件，20 秒超时 */
const realFetch: FetchLike = async (url, init) => {
  const res = await httpFetch(url, { method: init.method, headers: init.headers, body: init.body, signal: AbortSignal.timeout(20_000) });
  return { status: res.status, text: () => res.text() };
};

export function Main({ ctx }: { ctx: Ctx }) {
  const preview = location.pathname.endsWith('preview.html');
  const [platform, setPlatform] = useState<PlatformId>('wecom');
  const [urls, setUrls] = useState(EMPTY_MAP);
  const [secrets, setSecrets] = useState(EMPTY_MAP);
  const [text, setText] = useState(() => tplText('wecom-text'));
  const [tpl, setTpl] = useState('wecom-text');
  const [result, setResult] = useState<SendResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (preview) {
      import('./preview').then(({ demo }) => {
        setPlatform(demo.platform); setUrls(demo.urls); setSecrets(demo.secrets); setText(demo.text); setTpl('');
        setResult(demo.result); setHistory(demo.history); setNotice(demo.notice ?? null);
      });
      return;
    }
    settingsStore().then(async (s) => {
      const c = await s.get<Saved>(KEY);
      if (c) { setPlatform(c.platform); setUrls({ ...EMPTY_MAP, ...c.urls }); setSecrets({ ...EMPTY_MAP, ...c.secrets }); if (c.platform !== 'wecom') { const t = templatesOf(c.platform)[0]; setTpl(t.id); setText(JSON.stringify(t.body, null, 2)); } }
      setHistory((await s.get<HistoryEntry[]>(HIST_KEY)) ?? []);
    }).catch(() => {});
  }, [preview]);

  const persist = (p: PlatformId, u: Record<PlatformId, string>, sec: Record<PlatformId, string>) => {
    if (!preview) settingsStore().then((s) => s.set(KEY, { platform: p, urls: u, secrets: sec })).catch(() => {});
  };
  const pf = platformOf(platform);
  const url = urls[platform];
  const secret = secrets[platform];
  const urlCheck = url.trim() ? checkWebhook(platform, url) : null;
  const prep = useMemo(() => prepare(platform, text), [platform, text]);
  const tpls = templatesOf(platform);
  const curTpl = tpls.find((t) => t.id === tpl);

  const changePlatform = (p: PlatformId) => {
    setPlatform(p); setConfirm(false); setResult(null); setNotice(null);
    const t = templatesOf(p)[0];
    setTpl(t.id); setText(JSON.stringify(t.body, null, 2));
    persist(p, urls, secrets);
  };
  const setUrl = (v: string) => {
    const other = detectPlatform(v);
    const u = { ...urls, [platform]: v };
    setUrls(u); setConfirm(false); persist(platform, u, secrets);
    if (other && other !== platform) setNotice({ kind: 'err', text: `这个地址是${platformOf(other).short}的，已提示；可在上方切换到${platformOf(other).short}` });
    else setNotice(null);
  };
  const setSecret = (v: string) => { const s = { ...secrets, [platform]: v }; setSecrets(s); persist(platform, urls, s); };
  const pickTpl = (id: string) => { setTpl(id); setConfirm(false); setText(JSON.stringify(tpls.find((t) => t.id === id)!.body, null, 2)); };
  const format = () => { if (prep.ok || prep.issues.length) { try { setText(JSON.stringify(JSON.parse(text), null, 2)); } catch { /* 语法错时不动 */ } } };

  const chooseImage = async () => {
    try {
      const [p] = await pickFiles(['png', 'jpg', 'jpeg'], '图片');
      if (!p) return;
      const bytes = await ctx.readFile(p);
      setText(JSON.stringify(wecomImageBody(bytes), null, 2));
      setTpl('wecom-image'); setNotice(null);
    } catch (e) { setNotice({ kind: 'err', text: e instanceof Error ? e.message : String(e) }); }
  };

  const doSend = async () => {
    if (!prep.ok) return;
    setBusy(true); setConfirm(false); setNotice(null);
    try {
      const fetchFn: FetchLike = preview
        ? async () => ({ status: 200, text: async () => '{"errcode":0,"errmsg":"ok"}' })
        : realFetch;
      const req = await buildRequest(platform, url, prep.msg, secret, Date.now());
      const r = await send(fetchFn, platform, req);
      setResult(r);
      const h = addHistory(history, toHistory(r, messageType(platform, prep.msg)));
      setHistory(h);
      if (!preview) settingsStore().then((s) => s.set(HIST_KEY, h)).catch(() => {});
    } catch (e) { setNotice({ kind: 'err', text: e instanceof Error ? e.message : String(e) }); }
    setBusy(false);
  };

  const errors = prep.issues.filter((i) => i.level === 'error');
  const warns = prep.issues.filter((i) => i.level === 'warn');
  const canSend = prep.ok && !!urlCheck?.ok && !busy;
  const rate = rateWarning(history, platform, Date.now());

  return (
    <div className="wd-root">
      {notice && <div className={`k-notice ${notice.kind}`} role="status">{notice.text}</div>}

      <section className="k-panel wd-card">
        <div className="wd-hd"><b>1. 机器人</b><span className="k-help">Webhook 地址和密钥只保存在本机，界面里以密码点显示，记录里不出现</span></div>
        <div className="wd-row">
          {PLATFORMS.map((p) => <button key={p.id} className={`wd-tab ${p.id === platform ? 'on' : ''}`} onClick={() => changePlatform(p.id)}>{p.short}</button>)}
          <span className="wd-grow" />
          <button className="k-btn ghost" onClick={() => void openLink(pf.doc)}><ExternalLink size={14} />官方文档</button>
        </div>
        <div className="wd-two">
        <label className="wd-field">Webhook 地址
          <input className="k-input" type="password" autoComplete="off" aria-label="Webhook 地址" value={url} placeholder={pf.example} onChange={(e) => setUrl(e.target.value)} />
        </label>
        {pf.signLabel && (
          <label className="wd-field">{pf.signLabel}（可选）
            <input className="k-input" type="password" autoComplete="off" aria-label={pf.signLabel} value={secret} placeholder="没开加签就留空" onChange={(e) => setSecret(e.target.value)} />
          </label>
        )}
        </div>
        {urlCheck && !urlCheck.ok && <span className="wd-bad">{urlCheck.error}</span>}
        {pf.signHelp && <span className="k-help">{pf.signHelp}</span>}
        <span className="k-help">限制：{pf.rate}{platform === 'dingtalk' ? '（钉钉数字未能在本次复核，以官方文档为准）' : ''}。企业微信群机器人没有签名功能。</span>
      </section>

      <div className="wd-main">
      <section className="k-panel wd-card">
        <div className="wd-hd"><b>2. 消息</b><span className="k-help">选一个模板改，或直接粘贴 JSON；{pf.typeKey} 是消息类型字段</span></div>
        <div className="wd-row">
          {tpls.map((t) => <button key={t.id} className={`wd-chip ${t.id === tpl ? 'on' : ''}`} onClick={() => pickTpl(t.id)} title={KIND_LABEL[t.kind]}>{t.label}</button>)}
        </div>
        {curTpl?.note && <span className="k-help">{curTpl.note}</span>}
        <textarea className="k-input k-textarea wd-json" aria-label="消息 JSON" spellCheck={false} rows={8} value={text} onChange={(e) => { setText(e.target.value); setConfirm(false); }} />
        <div className="wd-row">
          <button className="k-btn" onClick={format} disabled={!prep.ok && !prep.issues.length}><Wand2 size={15} />格式化</button>
          {platform === 'wecom' && <button className="k-btn" onClick={() => void chooseImage()}><FileImage size={15} />选图片（自动算 base64 和 md5）</button>}
          {!prep.ok && prep.syntax && <span className="wd-bad">JSON 第 {prep.line} 行第 {prep.col} 列：{prep.syntax}</span>}
          {prep.ok && !warns.length && <span className="wd-good">格式检查通过</span>}
        </div>
        {errors.map((i, k) => <div key={'e' + k} className="wd-bad">{i.path ? `${i.path}：` : ''}{i.message}</div>)}
        {warns.map((i, k) => <div key={'w' + k} className="wd-warn">{i.path ? `${i.path}：` : ''}{i.message}</div>)}
      </section>

      <section className="k-panel wd-card">
        <div className="wd-hd"><b>3. 发送</b>
          {!confirm && <button className="k-btn primary" disabled={!canSend} onClick={() => setConfirm(true)}>{busy ? <Loader2 size={15} className="k-spin" /> : <Send size={15} />}发送到群里</button>}
          {confirm && (
            <span className="wd-confirm">真的会向{pf.short}群发出一条消息。
              <button className="k-btn" onClick={() => setConfirm(false)}>取消</button>
              <button className="k-btn primary" onClick={() => void doSend()}>确认发送</button>
            </span>
          )}
          {rate && <span className="wd-warn">{rate}</span>}
        </div>
        {!canSend && !busy && <span className="k-help">{!urlCheck ? '先填 Webhook 地址' : !urlCheck.ok ? '地址格式不对，见上方提示' : '消息格式有错，见上方提示'}</span>}
        {result && (
          <div className="wd-result">
            <div className="wd-row">
              <span className={`wd-badge ${result.explain.ok ? 'ok' : 'err'}`}>{result.explain.ok ? '成功' : '失败'}</span>
              {result.status !== undefined && <span className="k-num">HTTP {result.status}</span>}
              <span className="k-num k-muted">{result.ms} ms</span>
              <span className="wd-hint">{result.explain.hint}</span>
            </div>
            <div className="wd-cols">
              <div><div className="wd-sub">请求（地址与签名已打码）<CopyButton text={`POST ${result.shownUrl}\n${result.requestBody}`} /></div>
                <pre className="wd-pre">POST {result.shownUrl}{'\n'}{result.requestBody}</pre></div>
              <div><div className="wd-sub">原始响应<CopyButton text={prettyResponse(result.responseText)} /></div>
                <pre className="wd-pre">{result.networkError ? `（网络层失败）${result.networkError}` : prettyResponse(result.responseText) || '（空）'}</pre></div>
            </div>
          </div>
        )}
      </section>

      </div>

      {history.length > 0 && (
        <section className="k-panel wd-card">
          <div className="wd-hd"><b>发送记录</b><span className="k-help">只记时间、平台、类型和结果，不记地址、密钥和消息内容</span></div>
          <div className="k-scroll wd-hist">
            <table className="k-table">
              <thead><tr><th>时间</th><th>平台</th><th>类型</th><th>HTTP</th><th>耗时</th><th>结果</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}><td className="k-num">{fmt(h.at)}</td><td>{platformOf(h.platform).short}</td><td>{h.type}</td><td className="k-num">{h.status ?? '—'}</td><td className="k-num">{h.ms} ms</td>
                    <td><span className={h.ok ? 'wd-good' : 'wd-bad'}>{h.summary}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
