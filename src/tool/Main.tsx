// 群机器人调试器：选平台 → 填地址 → 写消息（模板 / JSON）→ 校验 → 发送 → 看原始响应与中文解释。
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink, FileImage, Loader2, Send, ShieldCheck, Wand2, XCircle } from 'lucide-react';
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

  const verdict = result ? (result.explain.ok ? 'ok' : 'err') : null;
  const hint = !urlCheck ? '先填机器人地址' : !urlCheck.ok ? '地址格式不对，见上方提示' : '消息格式有错，见下方提示';

  return (
    <div className="wd-root">
      {notice && <div className={`k-notice ${notice.kind}`} role="status">{notice.text}</div>}

      <header className="wd-bar">
        <div className="wd-seg" role="tablist" aria-label="选择平台">
          {PLATFORMS.map((p) => <button key={p.id} role="tab" aria-selected={p.id === platform} className={`wd-tab ${p.id === platform ? 'on' : ''}`} onClick={() => changePlatform(p.id)}><i className={`wd-dot ${p.id}`} />{p.short}</button>)}
        </div>
        <label className="wd-field wd-url">机器人地址
          <input className="k-input" type="password" autoComplete="off" aria-label="机器人地址" value={url} placeholder={pf.example} onChange={(e) => setUrl(e.target.value)} />
        </label>
        {pf.signLabel && (
          <label className="wd-field wd-sec">{pf.signLabel}（可选）
            <input className="k-input" type="password" autoComplete="off" aria-label={pf.signLabel} value={secret} placeholder="没开加签就留空" onChange={(e) => setSecret(e.target.value)} />
          </label>
        )}
        <button className="k-btn ghost" onClick={() => void openLink(pf.doc)}><ExternalLink size={14} />官方文档</button>
        <div className="wd-note">
          <ShieldCheck size={14} />
          <span>地址和密钥只保存在本机，界面里以点显示，记录里不出现</span>
          {urlCheck && !urlCheck.ok && <b className="wd-bad">{urlCheck.error}</b>}
          {urlCheck?.ok && <b className="wd-good">地址格式正确</b>}
          <span className="wd-lim">限制：{pf.rate}{platform === 'dingtalk' ? '（钉钉数字未能在本次复核，以官方文档为准）' : ''}。企业微信群机器人没有签名功能。{pf.signHelp ? ` ${pf.signHelp}` : ''}</span>
        </div>
      </header>

      <div className="wd-main">
        <section className="wd-pane wd-compose" aria-label="写消息">
          <div className="wd-ph"><b>写消息</b><span className="wd-sub">选一个模板改，或直接粘贴 JSON；{pf.typeKey} 是消息类型字段</span></div>
          <div className="wd-chips">
            {tpls.map((t) => <button key={t.id} className={`wd-chip ${t.id === tpl ? 'on' : ''}`} onClick={() => pickTpl(t.id)} title={KIND_LABEL[t.kind]}>{t.label}</button>)}
          </div>
          {curTpl?.note && <span className="wd-sub">{curTpl.note}</span>}
          <textarea className="wd-json" aria-label="消息 JSON" spellCheck={false} rows={6} value={text} onChange={(e) => { setText(e.target.value); setConfirm(false); }} />
          <div className="wd-check">
            {!prep.ok && prep.syntax ? <span className="wd-bad"><XCircle size={14} />JSON 第 {prep.line} 行第 {prep.col} 列：{prep.syntax}</span>
              : prep.ok && !warns.length ? <span className="wd-good"><CheckCircle2 size={14} />格式检查通过</span>
              : <span className="wd-sub">{errors.length} 处错误，{warns.length} 处提醒</span>}
            <span className="wd-grow" />
            <button className="k-btn" onClick={format} disabled={!prep.ok && !prep.issues.length}><Wand2 size={15} />格式化</button>
            {platform === 'wecom' && <button className="k-btn" onClick={() => void chooseImage()}><FileImage size={15} />选图片（自动算出图片编码和校验值）</button>}
          </div>
          {errors.map((i, k) => <div key={'e' + k} className="wd-issue err">{i.path ? `${i.path}：` : ''}{i.message}</div>)}
          {warns.map((i, k) => <div key={'w' + k} className="wd-issue warn">{i.path ? `${i.path}：` : ''}{i.message}</div>)}
          <div className="wd-send">
            {!confirm && <button className="k-btn primary big" disabled={!canSend} onClick={() => setConfirm(true)}>{busy ? <Loader2 size={15} className="k-spin" /> : <Send size={15} />}发送到群里</button>}
            {confirm && (
              <span className="wd-confirm">真的会向{pf.short}群发出一条消息。
                <button className="k-btn" onClick={() => setConfirm(false)}>取消</button>
                <button className="k-btn primary" onClick={() => void doSend()}>确认发送</button>
              </span>
            )}
            {!canSend && !busy && <span className="wd-sub">{hint}</span>}
            {rate && <span className="wd-warn">{rate}</span>}
          </div>
        </section>

        <section className={`wd-pane wd-wire ${verdict ?? ''}`} aria-label="往返结果">
          {!result ? (
            <div className="wd-idle">
              <div className="wd-flow" aria-hidden="true">
                <span className="wd-node">本机</span><ArrowRight size={16} /><span className="wd-node">{pf.short}机器人</span><ArrowRight size={16} /><span className="wd-node">群里</span>
              </div>
              <b>发出后在这里看往返</b>
              <span className="wd-sub">实际请求（地址和签名已打码）、状态码、耗时、平台原始响应，以及用中文解释的返回码含义</span>
            </div>
          ) : (
            <>
              <div className="wd-verdict">
                <div className="wd-stamp">
                  {result.explain.ok ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                  <span className="wd-big k-num">{result.status ?? '无响应'}</span>
                  <span className="wd-badge">{result.explain.ok ? '成功' : '失败'}</span>
                </div>
                <span className="k-num wd-ms">{result.ms} ms</span>
              </div>
              <p className="wd-hint">{result.explain.hint}</p>
              <div className="wd-sub2">发出的请求（地址与签名已打码）<CopyButton text={`POST ${result.shownUrl}\n${result.requestBody}`} /></div>
              {/* check-zh: 忽略（原样显示发出的请求） */}
              <pre className="wd-pre">POST {result.shownUrl}{'\n'}{result.requestBody}</pre>
              <div className="wd-sub2">平台返回的原始响应<CopyButton text={prettyResponse(result.responseText)} /></div>
              <pre className="wd-pre">{result.networkError ? `（网络层失败）${result.networkError}` : prettyResponse(result.responseText) || '（空）'}</pre>
            </>
          )}
        </section>
      </div>

      {history.length > 0 && (
        <section className="wd-log" aria-label="发送记录">
          <div className="wd-ph"><b>发送记录</b><span className="wd-sub">只记时间、平台、类型和结果，不记地址、密钥和消息内容</span></div>
          <ol className="wd-hist">
            {history.map((h, i) => (
              <li key={i} className={h.ok ? 'ok' : 'err'}>
                <i className={`wd-dot ${h.platform}`} />
                <span className="k-num">{fmt(h.at)}</span>
                <b>{platformOf(h.platform).short}</b>
                <span>{h.type}</span>
                <span className="k-num">{h.status ?? '—'}</span>
                <span className="k-num wd-sub">{h.ms} ms</span>
                <span className={h.ok ? 'wd-good' : 'wd-bad'}>{h.summary}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
