// 网络结构图（arch）的动画版。几何、文字、配色逐项照 method_fig_1012/make_arch.py（1680×860 画布，
// arch_zh/en.png 就是它的 2.5 倍渲染），只在上面加数据流动画。一圈 12 秒：
//   0.0–2.9  带噪潜变量、低模代理画面依次亮，流入 Patch 嵌入；148 通道条三段依次填色，token 网格逐行点亮
//   2.6–6.6  ×30 主干：层数 1 数到 30；因果自注意力亮时 K/V 缓存条左移一格（新块从右进、最旧从左出）、K/V 下行；
//            交叉注意力亮时 caption → 文本 K/V 上行；前馈网络亮；时间步两条线经 AdaLN 一直在流
//   6.3–10.6 输出头 → 流匹配更新（小循环转两圈，表示 1 到 2 步）→ TAEHV 解码，4 帧依次出现
//   9.4–11.0 t=0 去控制重跑那条线流回缓存，最右一格由当前色（深岩灰）变成已写入的灰
//   11.4–12  通道条、token 网格、解码帧淡回初始状态，接下一圈
// 接口：MG4Fig.arch(host) 往 host 里放一个 SVG 并开始播放，返回 { play, pause, seek }。
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1680, H = 860, T = 12;

  const INK = 'var(--ink)', SUB = 'var(--sub)', LINE = '#8F969C', WIN = '#C7CDD2';
  const R = {
    SLATE_T: { fill: 'var(--slate-l)', stroke: '#8E979F', accent: '#5F6A74' },
    STATE: { fill: 'var(--sage-l)', stroke: '#97A38D', accent: 'var(--sage)' },
    SEM: { fill: 'var(--mauve-l)', stroke: '#A398AE', accent: 'var(--mauve)' },
    LOOK: { fill: 'var(--sand-l)', stroke: '#BCAA8E', accent: 'var(--sand)' },
    MEM: { fill: 'var(--rose-l)', stroke: '#C2A19A', accent: 'var(--rose)' },
    OURS: { fill: 'var(--slate)', stroke: 'var(--slate)', accent: '#D8C7AA' },
    NEUT: { fill: '#FFFFFF', stroke: '#A9AFB4', accent: '#8F969C' },
  };

  const L = (zh, en) => ({ zh, en });
  const S = {
    h: [L('输  入', 'INPUTS'), L('嵌  入', 'EMBEDDING'), L('因 果 DiT 主 干', 'CAUSAL DiT BACKBONE'), L('输  出', 'OUTPUT')],
    noisy: [L('带噪潜变量', 'Noisy Latent'), L('1 个潜变量 = 4 帧', '1 latent = 4 frames')],
    proxy: [L('低模代理画面', 'Low-poly Proxy'), L('4 帧 → TAEHV 编码', '4 frames → TAEHV')],
    cap: [L('动态 caption', 'Dynamic Caption'), L('umT5-xxl 编码', 'umT5-xxl encoder')],
    t: [L('时间步 t', 'Timestep t'), L('正弦编码 → MLP', 'sinusoidal → MLP')],
    patch: [L('Patch 嵌入', 'Patch Embedding'), L('Conv3d 1×2×2 → 3072 维', 'Conv3d 1×2×2 → 3072-d')],
    ch: L('148 通道', '148 channels'),
    seg: [L('带噪 48', 'noisy 48'), L('控制 48', 'control 48'), L('置零 52', 'zeros 52')],
    tok: L('15 × 27 = 405 token / 潜变量', '15 × 27 = 405 tokens / latent'),
    kv: L('自注意力 K/V 缓存', 'SELF-ATTENTION KV CACHE'),
    g: [L('记忆 3', 'memory 3'), L('参考帧', 'references'), L('最近 20 块', 'latest 20 chunks')],
    sa: [L('因果自注意力', 'Causal Self-Attn'), L('3D RoPE · QK-Norm · 24 头', '3D RoPE · QK-Norm · 24 heads')],
    ca: [L('交叉注意力', 'Cross-Attn'), L('查询文本 K/V', 'queries text K/V')],
    ffn: [L('前馈网络', 'FFN'), L('3072 → 14336', '3072 → 14336')],
    ada: L('AdaLN 调制', 'AdaLN'),
    tag: L('FP8 · SageAttention 2 · CUDA Graph', 'FP8 · SageAttention 2 · CUDA Graph'),
    tkv: [L('文本 K/V 缓存', 'Text KV Cache'), L('caption 变了才重算', 'recomputed on new caption')],
    head: [L('输出头', 'Output Head'), L('LN · Linear · 还原 patch', 'LN · Linear · unpatchify')],
    flow: [L('流匹配更新', 'Flow Update'), L('z ← z − σ·v，1 到 2 步', 'z ← z − σ·v, 1 to 2 steps')],
    dec: [L('TAEHV 解码', 'TAEHV Decoder'), L('4 帧 · 480×864', '4 frames · 480×864')],
    wb: L('t=0、去控制重跑后写入', 're-run at t=0 without control'),
    lg: [L('引擎条件', 'engine condition'), L('VLM 文本', 'VLM text'), L('参考帧', 'references'), L('空间记忆', 'spatial memory'), L('生成主干', 'backbone')],
  };

  // ---------- 画图小工具 ----------
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    let st = '';
    for (const k in attrs) {
      const v = attrs[k];
      if (v == null) continue;
      // 页面变量写进 style，避免个别浏览器不认属性里的 var()
      if ((k === 'fill' || k === 'stroke') && typeof v === 'string' && v.startsWith('var(')) st += k + ':' + v + ';';
      else e.setAttribute(k, v);
    }
    if (st) e.setAttribute('style', st);
    if (parent) parent.appendChild(e);
    return e;
  }
  const rect = (p, x, y, w, h, fill, stroke, sw, rx, extra) =>
    el('rect', Object.assign({ x, y, width: w, height: h, rx: rx || 0, ry: rx || 0, fill, stroke: stroke || 'none', 'stroke-width': sw || 1 }, extra), p);
  const circle = (p, cx, cy, r, fill, stroke, sw) => el('circle', { cx, cy, r, fill, stroke: stroke || 'none', 'stroke-width': sw || 1 }, p);
  const line = (p, x1, y1, x2, y2, stroke, sw) => el('line', { x1, y1, x2, y2, stroke, 'stroke-width': sw }, p);
  const tri = (p, cx, top, base, half, fill) =>
    el('path', { d: `M ${cx.toFixed(1)} ${top.toFixed(1)} L ${(cx + half).toFixed(1)} ${base.toFixed(1)} L ${(cx - half).toFixed(1)} ${base.toFixed(1)} Z`, fill }, p);

  // 原 PNG 里加粗的字只有西文变粗、中文仍是常规字重，这里照抄：粗体文字中的中文段落单独降到 400
  const CJK = /[⺀-鿿　-〿＀-￯]+/g;
  function fillText(t, s, weight) {
    if (weight >= 500 && /[⺀-鿿　-〿＀-￯]/.test(s)) {
      let last = 0;
      s.replace(CJK, (m, i) => {
        if (i > last) t.appendChild(document.createTextNode(s.slice(last, i)));
        el('tspan', { 'font-weight': 400 }, t).textContent = m;
        last = i + m.length;
        return m;
      });
      if (last < s.length) t.appendChild(document.createTextNode(s.slice(last)));
    } else t.textContent = s;
  }
  function txt1(p, x, y, s, size, fill, weight, anchor, lang) {
    const t = el('text', { x, y, 'font-size': size, 'font-weight': weight || 400, fill, 'text-anchor': anchor || 'start', lang }, p);
    fillText(t, s, weight || 400);
    return t;
  }
  // 每段文字中英各一个 <text>，页面 CSS 按 data-lang 只显示一个
  function txt(p, x, y, s, size, fill, weight, anchor) {
    const sz = typeof size === 'number' ? L(size, size) : size;
    return ['zh', 'en'].map((lg) => txt1(p, x, y, s[lg], sz[lg], fill, weight, anchor, lg));
  }

  // 直角折线加实心三角箭头（同 make_fig.arrow），另叠一条流动虚线，平时透明
  function arrow(p, pts, color, sw) {
    const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
    const d = x2 > x1 ? 'r' : x2 < x1 ? 'l' : y2 > y1 ? 'd' : 'u';
    const s = 9, h = s * 0.55;
    const tail = { r: [x2 - s, y2], l: [x2 + s, y2], d: [x2, y2 - s], u: [x2, y2 + s] }[d];
    const P = pts.slice(0, -1).concat([tail]).map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
    const base = el('polyline', { points: P, fill: 'none', stroke: color, 'stroke-width': sw }, p);
    const fl = el('polyline', { points: P, fill: 'none', stroke: color, 'stroke-width': sw + 1.3, 'stroke-dasharray': '7 6', opacity: 0 }, p);
    const hp = { r: [[x2, y2], [x2 - s, y2 - h], [x2 - s, y2 + h]], l: [[x2, y2], [x2 + s, y2 - h], [x2 + s, y2 + h]],
      u: [[x2, y2], [x2 - h, y2 + s], [x2 + h, y2 + s]], d: [[x2, y2], [x2 - h, y2 - s], [x2 + h, y2 - s]] }[d];
    el('polygon', { points: hp.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' '), fill: color }, p);
    return { base, fl };
  }

  function card(p, x, y, w, h, role, title, sub, tsize) {
    const g = el('g', {}, p);
    rect(g, x, y, w, h, role.fill, role.stroke, 1.2, 8);
    rect(g, x + 22, y + 20, 26, 4, role.accent);
    txt(g, x + 22, y + 54, title, tsize || 20, INK, 600);
    txt(g, x + 22, y + 79, sub, 14, SUB, 400);
    const ring = rect(g, x, y, w, h, 'none', role.accent, 2.2, 8, { opacity: 0 });
    return { g, ring, cx: x + w / 2, cy: y + h / 2, k: 0.015 };
  }

  function block(p, x, y, w, h, role, title, sub, dark) {
    const g = el('g', {}, p);
    rect(g, x, y, w, h, role.fill, role.stroke, dark ? 1.6 : 1.2, 8);
    const lit = dark ? rect(g, x, y, w, h, '#FFFFFF', 'none', 0, 8, { opacity: 0 }) : null;
    const cx = x + w / 2;
    txt(g, cx, y + h / 2 - 4, title, 18, dark ? '#FFFFFF' : INK, 600, 'middle');
    txt(g, cx, y + h / 2 + 20, sub, 13, dark ? '#C9D0D6' : SUB, 400, 'middle');
    const ring = rect(g, x - 4.5, y - 4.5, w + 9, h + 9, 'none', dark ? 'var(--slate)' : role.accent, 1.6, 11, { opacity: 0 });
    return { g, ring, lit, cx, cy: y + h / 2, k: 0.012 };
  }

  function lowpolyThumb(p, x, y, w, h) {
    const e = '#6E757B';
    rect(p, x, y, w, h, '#ECEEEF', e, 0.8);
    rect(p, x, y + h * 0.58, w, h * 0.42, '#D2D5D7');
    for (let i = 0; i < 4; i++) rect(p, x + w * (0.40 + 0.15 * i), y + h * (0.70 + 0.12 * (i % 2)), w * 0.075, h * 0.12, '#DEE1E3');
    rect(p, x, y, w * 0.32, h * 0.80, '#C9B79C', e, 0.6);
    rect(p, x + w * 0.44, y + h * 0.30, w * 0.12, h * 0.30, '#A79FB1', e, 0.6);
    rect(p, x + w * 0.62, y + h * 0.40, w * 0.38, h * 0.18, '#A9B59E', e, 0.6);
    rect(p, x + w * 0.735, y + h * 0.22, w * 0.025, h * 0.22, '#8C8478');
    circle(p, x + w * 0.75, y + h * 0.20, h * 0.13, '#9AAA90', e, 0.6);
    rect(p, x + w * 0.20, y + h * 0.62, w * 0.10, h * 0.20, '#8FA1AE', e, 0.6);
    rect(p, x + w * 0.22, y + h * 0.48, w * 0.08, h * 0.14, '#B7A98D', e, 0.6);
  }

  function richThumb(p, x, y, w, h) {
    rect(p, x, y, w, h, '#DCE4EA', '#5E666D', 0.8);
    rect(p, x + 0.5, y + h * 0.20, w - 1, h * 0.22, '#E6ECF0');
    tri(p, x + w * 0.55, y + h * 0.18, y + h * 0.56, w * 0.24, '#A9B5BE');
    tri(p, x + w * 0.82, y + h * 0.10, y + h * 0.56, w * 0.22, '#9AA7B1');
    tri(p, x + w * 0.82, y + h * 0.10, y + h * 0.20, w * 0.048, '#F4F6F7');
    rect(p, x + 0.5, y + h * 0.55, w - 1, h * 0.45 - 0.5, '#8E9C78');
    for (let i = 0; i < 5; i++) {
      const gx = x + w * (0.42 + 0.11 * i);
      line(p, gx, y + h * (0.86 - 0.04 * (i % 2)), gx, y + h * (0.76 - 0.04 * (i % 2)), '#6F7D5D', 0.8);
    }
    rect(p, x + 0.5, y + 0.5, w * 0.32, h * 0.80, '#B9A78B');
    for (let k = 1; k < 6; k++) line(p, x + 0.5, y + h * 0.13 * k, x + w * 0.32, y + h * 0.13 * k, '#9C8B72', 0.6);
    rect(p, x + w * 0.735, y + h * 0.24, w * 0.025, h * 0.30, '#7A6F63');
    circle(p, x + w * 0.71, y + h * 0.24, h * 0.11, '#7F9070');
    circle(p, x + w * 0.79, y + h * 0.20, h * 0.12, '#93A383');
    circle(p, x + w * 0.75, y + h * 0.12, h * 0.10, '#859676');
    rect(p, x + w * 0.21, y + h * 0.60, w * 0.07, h * 0.22, '#B98F86');
    circle(p, x + w * 0.245, y + h * 0.55, h * 0.06, '#E2C9B8');
    rect(p, x + w * 0.208, y + h * 0.82, w * 0.03, h * 0.08, '#5E666D');
    rect(p, x + w * 0.252, y + h * 0.82, w * 0.03, h * 0.08, '#5E666D');
  }

  // ---------- 时间轴 ----------
  const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const ramp = (t, a, b) => sm((t - a) / (b - a));
  const env = (t, a, b, f) => {
    f = Math.min(f || 0.3, (b - a) / 2);
    return Math.min(ramp(t, a, a + f), 1 - ramp(t, b - f, b));
  };
  function set(e, k, v) {
    if (typeof v === 'number') v = +v.toFixed(3);
    const c = e._mg || (e._mg = {});
    if (c[k] !== v) { c[k] = v; e.setAttribute(k, v); }
  }

  window.MG4Fig = window.MG4Fig || {};
  window.MG4Fig.arch = function (host) {
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Model architecture / 网络结构' });
    svg.setAttribute('style', 'width:100%;height:auto;display:block;font-family:var(--font)');
    const uid = 'mg4arch' + Math.random().toString(36).slice(2, 8);
    rect(svg, 0, 0, W, H, '#FFFFFF');

    [[40, 270], [320, 540], [590, 1250], [1300, 1640]].forEach(([x0, x1], i) => {
      txt(svg, x0, 60, S.h[i], 13, LINE, 600);
      line(svg, x0, 76, x1, 76, 'var(--hair)', 1.0);
    });
    const AX = 325;

    // ---------- 输入 ----------
    const cNoisy = card(svg, 40, 150, 230, 100, R.SLATE_T, ...S.noisy);
    const shades = ['#B9C0C6', '#D5DADF', '#A6AEB5', '#E3E6E9', '#C7CDD2'];
    const noise = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      noise.push({ e: rect(cNoisy.g, 212 + c * 10.5, 207 + r * 10.5, 9, 9, shades[(r * 7 + c * 3) % 5]), i: r * 7 + c * 3 });
    }
    const cProxy = card(svg, 40, 270, 230, 150, R.STATE, ...S.proxy);
    const stack = [2, 1].map((k) => ({ k, e: rect(cProxy.g, 62 + 6 * k, 370 - 6 * k, 72, 40, '#F5F6F7', '#B7BDC2', 0.8) }));
    lowpolyThumb(cProxy.g, 62, 370, 72, 40);
    const cTime = card(svg, 40, 520, 230, 100, R.NEUT, ...S.t);

    // ---------- Patch 嵌入：通道拼接条 + token 网格 ----------
    const cPatch = card(svg, 320, 150, 220, 300, R.SLATE_T, ...S.patch, 18);
    txt(cPatch.g, 342, 262, S.ch, 12, SUB, 600);
    const bx = 342, bw = 176;
    const track = rect(cPatch.g, bx, 272, bw, 24, 'none', '#C3C8CD', 0.8, 0, { 'stroke-dasharray': '3 2' });
    const barG = el('g', {}, cPatch.g);
    const segDef = [[48, WIN, null], [48, '#A9B59E', null], [48, '#F3F4F5', '#C3C8CD'], [4, '#E1E4E7', '#C3C8CD']];
    let sx = bx;
    const segs = segDef.map(([n, fill, st]) => {
      const w = bw * n / 148;
      const e = rect(barG, sx, 272, w, 24, fill, st || 'none', 0.8, 0, st ? { 'stroke-dasharray': '3 2' } : null);
      const o = { e, x0: sx, w };
      sx += w;
      return o;
    });
    [[segs[0].x0, segs[0].x0 + segs[0].w], [segs[1].x0, segs[1].x0 + segs[1].w], [segs[2].x0, segs[3].x0 + segs[3].w]].forEach(([a, b], i) => {
      txt(cPatch.g, (a + b) / 2, 314, S.seg[i], L(12, 11), SUB, 400, 'middle');
    });
    const toks = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
      toks.push({ e: rect(cPatch.g, 342 + c * 17, 336 + r * 17, 14, 14, (r + c) % 3 ? '#D2D8DD' : '#BAC2C9'), r, c });
    }
    txt1(cPatch.g, 500, 376, '…', 16, SUB, 600);
    txt(cPatch.g, 342, 428, S.tok, 12, SUB);
    const aNP = arrow(svg, [[270, 200], [320, 200]], R.SLATE_T.accent, 1.6);
    const aPP = arrow(svg, [[270, 345], [320, 345]], R.STATE.accent, 1.8);

    // ---------- 因果 DiT 主干（× 30） ----------
    const dit = rect(svg, 590, 215, 660, 260, 'var(--panel)', 'var(--slate)', 1.6, 16);
    const rep = txt1(svg, 1236, 249, '× 30', 22, 'var(--slate)', 700, 'end');
    txt(svg, 1180, 246, S.tag, 11, SUB, 400, 'end');
    const aPC = arrow(svg, [[540, AX], [615, AX]], LINE, 1.8);
    const bSA = block(svg, 615, 260, 220, 130, R.OURS, ...S.sa, true);
    const aSC = arrow(svg, [[835, AX], [865, AX]], LINE, 1.6);
    const bCA = block(svg, 865, 260, 170, 130, R.SEM, ...S.ca);
    const aCF = arrow(svg, [[1035, AX], [1065, AX]], LINE, 1.6);
    const bFF = block(svg, 1065, 260, 160, 130, R.SLATE_T, ...S.ffn);
    const ada = [[615, 220], [1065, 160]].map(([x0, w]) => {
      const g = el('g', {}, svg);
      rect(g, x0, 410, w, 30, '#FFFFFF', R.NEUT.stroke, 1.0, 6);
      txt(g, x0 + w / 2, 430, S.ada, 12, SUB, 600, 'middle');
      const ring = rect(g, x0, 410, w, 30, 'none', R.SLATE_T.accent, 1.8, 6, { opacity: 0 });
      arrow(svg, [[x0 + w / 2, 410], [x0 + w / 2, 390]], LINE, 1.2);
      return { g, ring, cx: x0 + w / 2, cy: 425, k: 0 };
    });

    // 自注意力 K/V 缓存：记忆 3 · 参考帧 · 最近 20 块
    rect(svg, 590, 96, 440, 82, 'var(--panel)', 'none', 1, 10);
    const kvRing = rect(svg, 590, 96, 440, 82, 'none', R.MEM.stroke, 1.4, 10, { opacity: 0 });
    txt(svg, 606, 116, S.kv, 12, LINE, 600);
    let kx = 606;
    [3, 3].forEach((n, gi) => {
      const x0 = kx;
      for (let i = 0; i < n; i++) { rect(svg, kx, 152, 12, 12, gi ? R.LOOK.accent : R.MEM.accent); kx += 15; }
      txt(svg, (x0 + kx - 3) / 2, 143, S.g[gi], L(12, 10.5), SUB, 400, 'middle'); // 英文 Inter 比原图字体宽，10.5 号免得两组标签贴在一起
      kx = kx - 3 + 16;
    });
    const WX = kx; // 722：窗口第 0 格
    txt(svg, (WX + WX + 20 * 15 - 3) / 2, 143, S.g[2], L(12, 11), SUB, 400, 'middle');
    const clip = el('clipPath', { id: uid + 'w' }, el('defs', {}, svg));
    rect(clip, WX, 148, 20 * 15 - 2.5, 20);
    const winG = el('g', { 'clip-path': `url(#${uid}w)` }, svg);
    const slots = [];
    for (let k = 0; k <= 20; k++) {
      const g = el('g', {}, winG);
      rect(g, 0, 152, 12, 12, WIN);
      const cur = k === 20 ? rect(g, 0, 152, 12, 12, 'var(--slate)') : null;
      slots.push({ g, cur, k });
    }
    const aKV = arrow(svg, [[725, 178], [725, 260]], R.MEM.accent, 1.6);

    // 文本 K/V 缓存（交叉注意力）与时间步调制
    const cTkv = card(svg, 830, 520, 240, 90, R.SEM, ...S.tkv, 16);
    const aTC = arrow(svg, [[950, 520], [950, 390]], R.SEM.accent, 1.6);
    const cCap = card(svg, 830, 650, 240, 100, R.SEM, ...S.cap);
    const aCT = arrow(svg, [[950, 650], [950, 610]], R.SEM.accent, 1.6);
    const aT1 = arrow(svg, [[270, 570], [725, 570], [725, 440]], LINE, 1.4);
    const aT2 = arrow(svg, [[725, 570], [725, 785], [1145, 785], [1145, 440]], LINE, 1.4);

    // ---------- 输出 ----------
    const aFH = arrow(svg, [[1225, AX], [1300, AX]], LINE, 1.8);
    const cHead = card(svg, 1300, 270, 300, 110, R.SLATE_T, ...S.head);
    const aHF = arrow(svg, [[1450, 380], [1450, 430]], LINE, 1.6);
    const cFlow = card(svg, 1300, 430, 300, 110, R.SLATE_T, ...S.flow);
    // 流匹配的小循环：转一圈表示一步，原 PNG 里没有，只在动画里出现
    const LX = 1566, LY0 = 485, LR = 13;
    const loopG = el('g', { opacity: 0 }, cFlow.g);
    const spin = el('g', {}, loopG);
    const pt = (deg, r) => [LX + r * Math.sin(deg * Math.PI / 180), LY0 - r * Math.cos(deg * Math.PI / 180)];
    const [ex, ey] = pt(300, LR);
    el('path', { d: `M ${LX} ${LY0 - LR} A ${LR} ${LR} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`, fill: 'none', stroke: R.SLATE_T.accent, 'stroke-width': 1.6 }, spin);
    const tg = [Math.cos(300 * Math.PI / 180), Math.sin(300 * Math.PI / 180)], nr = [Math.sin(300 * Math.PI / 180), -Math.cos(300 * Math.PI / 180)];
    el('polygon', { points: [[ex + 5 * tg[0], ey + 5 * tg[1]], [ex - 2 * tg[0] + 4 * nr[0], ey - 2 * tg[1] + 4 * nr[1]], [ex - 2 * tg[0] - 4 * nr[0], ey - 2 * tg[1] - 4 * nr[1]]].map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' '), fill: R.SLATE_T.accent }, spin);
    const stepNo = txt1(loopG, LX, LY0 + 4, '1', 11, R.SLATE_T.accent, 700, 'middle');
    const aFD = arrow(svg, [[1450, 540], [1450, 590]], LINE, 1.6);
    const cDec = card(svg, 1300, 590, 300, 160, R.NEUT, ...S.dec);
    const thumbs = [];
    for (let i = 0; i < 4; i++) {
      rect(cDec.g, 1322 + i * 68, 692, 60, 34, 'none', '#D9DCDF', 0.8, 0, { 'stroke-dasharray': '3 2' });
      const g = el('g', {}, cDec.g);
      richThumb(g, 1322 + i * 68, 692, 60, 34);
      thumbs.push(g);
    }

    // 去噪完的干净潜变量以 t=0、不带控制重跑一遍，写进 K/V 缓存
    const aWB = arrow(svg, [[1600, 485], [1625, 485], [1625, 136], [1030, 136]], R.MEM.accent, 1.6);
    const pills = ['zh', 'en'].map((lg) => {
      const s = S.wb[lg], size = 12, w = s.length * size * (lg === 'zh' ? 1.0 : 0.6) + 22;
      const g = el('g', { lang: lg }, svg);
      rect(g, 1200 - w / 2, 123, w, 26, '#FFFFFF', R.MEM.stroke, 1.0, 13);
      const hi = rect(g, 1200 - w / 2, 123, w, 26, R.MEM.fill, R.MEM.accent, 1.6, 13, { opacity: 0 });
      txt1(g, 1200, 136 + size * 0.36, s, size, R.MEM.accent, 500, 'middle');
      return hi;
    });

    // 图例：颜色与方法图的角色一致
    ['zh', 'en'].forEach((lg) => {
      const g = el('g', { lang: lg }, svg);
      let x = 40;
      S.lg.forEach((lab, i) => {
        const s = lab[lg];
        rect(g, x, 824, 12, 12, [R.STATE.accent, R.SEM.accent, R.LOOK.accent, R.MEM.accent, R.OURS.fill][i]);
        txt1(g, x + 20, 835, s, 13, SUB);
        x += 20 + [...s].reduce((a, ch) => a + (ch.codePointAt(0) > 0x2E80 ? 13 : 7.2), 0) + 34;
      });
    });

    host.appendChild(svg);

    // ---------- 每帧状态 ----------
    function hl(o, a) {
      set(o.ring, 'opacity', a);
      if (o.lit) set(o.lit, 'opacity', 0.10 * a);
      const s = 1 + o.k * a;
      set(o.g, 'transform', o.k && a > 0.001 ? `translate(${o.cx} ${o.cy}) scale(${s.toFixed(4)}) translate(${-o.cx} ${-o.cy})` : '');
    }
    function flow(f, a, t) {
      set(f.fl, 'opacity', a);
      set(f.fl, 'stroke-dashoffset', a > 0 ? -((t * 55) % 13) : 0);
      set(f.base, 'opacity', 1 - 0.55 * a);
    }

    // still=true 时画成与 PNG 一致的完整静态状态（prefers-reduced-motion 用）
    function frame(t, still) {
      const E = (a, b, f) => (still ? 0 : env(t, a, b, f));
      const Rm = (a, b) => (still ? 1 : ramp(t, a, b));
      const reset = still ? 0 : ramp(t, 11.4, 12);

      // 输入
      const aN = E(0.0, 1.1);
      hl(cNoisy, aN);
      const sh = aN > 0.05 ? Math.floor(t * 7) : 0;
      noise.forEach((n) => set(n.e, 'fill', shades[(n.i + sh) % 5]));
      flow(aNP, E(0.3, 1.3), t);
      const aP = E(0.4, 1.5);
      hl(cProxy, aP);
      stack.forEach((s) => { set(s.e, 'x', 62 + 6 * s.k * (1 + 0.6 * aP)); set(s.e, 'y', 370 - 6 * s.k * (1 + 0.6 * aP)); });
      flow(aPP, E(0.6, 1.6), t);

      // Patch 嵌入
      hl(cPatch, E(1.0, 3.0));
      const q = [Rm(1.1, 1.5), Rm(1.5, 1.9), Rm(1.9, 2.3)];
      set(segs[0].e, 'width', segs[0].w * q[0]);
      set(segs[1].e, 'width', segs[1].w * q[1]);
      const zw = (segs[2].w + segs[3].w) * q[2];
      set(segs[2].e, 'width', Math.min(zw, segs[2].w));
      set(segs[3].e, 'width', Math.max(0, zw - segs[2].w));
      set(segs[3].e, 'opacity', zw > segs[2].w + 0.05 ? 1 : 0);
      set(barG, 'opacity', 1 - reset);
      set(track, 'opacity', 0.9 * (1 - Rm(1.1, 2.3) * (1 - reset)));
      toks.forEach((o) => {
        const lit = Rm(1.8 + o.r * 0.28 + o.c * 0.025, 1.98 + o.r * 0.28 + o.c * 0.025) * (1 - reset);
        set(o.e, 'opacity', 0.22 + 0.78 * lit);
      });

      // 主干
      flow(aPC, E(2.6, 3.4), t);
      set(dit, 'stroke-width', 1.6 + 0.8 * E(2.9, 6.6));
      const n = still || t < 3.0 || t >= 6.4 ? 30 : Math.min(30, 1 + Math.floor((t - 3.0) / 3.4 * 30));
      if (rep._n !== n) { rep._n = n; rep.textContent = '× ' + n; }

      // 自注意力 + K/V 缓存滚动：整条左移一格，最旧的滑出左边界，新块从右边界进来
      const aSA = E(3.0, 4.3);
      hl(bSA, aSA);
      hl(ada[0], aSA);
      set(kvRing, 'opacity', Math.max(E(3.0, 4.3), E(10.3, 11.3)));
      const p = still ? 0 : ramp(t, 3.0, 3.6);
      const wv = still ? 1 : ramp(t, 10.6, 11.0);
      slots.forEach((s) => {
        set(s.g, 'transform', `translate(${(WX + (s.k - p) * 15).toFixed(2)} 0)`);
        if (s.k === 0) set(s.g, 'opacity', 1 - p);
        if (s.cur) set(s.cur, 'opacity', 1 - wv);
      });
      flow(aKV, E(3.3, 4.3), t);

      // 交叉注意力 + 文本 K/V
      flow(aSC, E(4.0, 4.7), t);
      hl(bCA, E(4.3, 5.4));
      hl(cCap, E(4.1, 5.3));
      flow(aCT, E(4.1, 5.0), t);
      hl(cTkv, E(4.3, 5.4));
      flow(aTC, E(4.4, 5.4), t);

      // 前馈网络
      flow(aCF, E(5.1, 5.8), t);
      const aFF = E(5.4, 6.5);
      hl(bFF, aFF);
      hl(ada[1], aFF);

      // 时间步经 AdaLN 调制：主干亮的整段时间都在流
      hl(cTime, E(3.0, 6.5));
      flow(aT1, E(3.0, 6.5), t);
      flow(aT2, E(3.0, 6.5), t);

      // 输出头 → 流匹配更新 → TAEHV 解码
      flow(aFH, E(6.3, 7.1), t);
      hl(cHead, E(6.6, 7.6));
      flow(aHF, E(7.2, 7.9), t);
      hl(cFlow, E(7.5, 9.2));
      set(loopG, 'opacity', E(7.5, 9.1));
      const turns = still ? 0 : ramp(t, 7.7, 8.2) + ramp(t, 8.35, 8.85);
      set(spin, 'transform', `rotate(${(360 * turns).toFixed(1)} ${LX} ${LY0})`);
      const step = !still && t >= 8.27 ? '2' : '1';
      if (stepNo.textContent !== step) stepNo.textContent = step;
      flow(aFD, E(8.8, 9.5), t);
      hl(cDec, E(9.0, 10.6));
      thumbs.forEach((g, i) => {
        const a = Rm(9.2 + 0.25 * i, 9.5 + 0.25 * i) * (1 - reset);
        set(g, 'opacity', a);
        set(g, 'transform', `translate(0 ${(4 * (1 - a)).toFixed(2)})`);
      });

      // t=0 去控制重跑，写回 K/V 缓存
      flow(aWB, E(9.4, 10.9), t);
      const aW = E(9.6, 10.9);
      pills.forEach((e) => set(e, 'opacity', aW));
    }

    const RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let raf = 0, running = false, last = 0, acc = 0;
    function tick(now) {
      acc = (acc + Math.min(0.25, Math.max(0, (now - last) / 1000))) % T;
      last = now;
      frame(acc);
      raf = requestAnimationFrame(tick);
    }
    function play() {
      if (RM || running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function pause() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    }
    function seek(sec) {
      acc = ((sec % T) + T) % T;
      frame(acc);
    }

    if (RM) frame(0, true);
    else { frame(0); play(); }
    return { play, pause, seek };
  };
})();
