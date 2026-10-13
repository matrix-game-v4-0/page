// 方法图「交互循环」动画版：复刻 assets/fig/loop_zh.png、loop_en.png。
// 坐标、文字、配色逐项照生成那两张 PNG 的 make_loop.py（1680×920 用户单位，PNG 是 2.5 倍渲染）。
// 一圈 12 秒：0 到 2.4 秒 (A) 会话初始化依次点亮，之后保持；2.4 到 12 秒 (B) 交互循环走两块，每块 4.8 秒。
(function () {
  'use strict';
  var W = 1680, H = 920, IMG = 'assets/fig/anim/loop_';
  var T = 12, A_END = 2.4, D = 4.8, DIM = 0.32;

  // 配色：有对应页面变量的用变量；角色描边这类浅色没有变量，沿用原图色值
  var INK = 'var(--ink)', SUB = 'var(--sub)', LINE = '#8F969C', SLATE = 'var(--slate)';
  var STATE = { fill: 'var(--sage-l)', stroke: '#97A38D', accent: 'var(--sage)' };   // 游戏引擎与低模画面
  var SEM = { fill: 'var(--mauve-l)', stroke: '#A398AE', accent: 'var(--mauve)' };   // VLM 与语义条件
  var LOOK = { fill: 'var(--sand-l)', stroke: '#BCAA8E', accent: 'var(--sand)' };    // 外观前缀
  var NEUT = { fill: '#FFFFFF', stroke: '#A9AFB4', accent: LINE };                   // 玩家与输出画面
  var HIST = '#8D979F', CUR = '#EEF0F2', NOISY = '#66707A', MID = '#AAB1B8';

  // 每段文字 [中文, 英文]，逐字照 make_loop.py 的 TXT
  var L = {
    A: ['(A) 会话初始化', '(A) Session setup'], Asub: ['每局一次', 'once per session'],
    B: ['(B) 交互循环', '(B) Interaction loop'], Bsub: ['每次一块', 'one chunk at a time'],
    open: ['开局低模画面', 'opening low-poly frame'], imgm: ['图像模型', 'image model'],
    refs: ['多参考帧', 'multi-reference frames'], prompt: ['+ prompt', '+ prompt'], enc1: ['只编码一次', 'encode once'],
    prefix: ['外观前缀', 'appearance prefix'], chip: ['文本 + 参考帧', 'TEXT + REFERENCES'],
    player: ['玩家', 'Player'], playerSub: ['W A S D · 射击', 'WASD · shoot'],
    harness: ['VLM + 游戏引擎 = 视频模型的 Harness', 'VLM + GAME ENGINE = VIDEO-MODEL HARNESS'],
    vlm: ['VLM', 'VLM'], vlmSub: ['规则之外的推理与想象', 'reasoning beyond rules'],
    chips: [['状态转 prompt', 'State to prompt'], ['想象补全', 'Imagine gaps'], ['演化推理', 'Reason evolution'], ['新区探索', 'Explore regions']],
    engine: ['代码游戏引擎', 'Code Game Engine'], engineSub: ['规则之内的状态演化', 'rule-based state evolution'],
    reg: ['注册', 'register'], ret: ['检索', 'retrieval'],
    cap: ['动态 caption', 'dynamic caption'], proxy: ['低模代理画面', 'low-poly proxy frames'],
    render: ['流式扩散渲染', 'STREAMING DIFFUSION RENDER'],
    taehv: ['TAEHV', 'TAEHV'], tenc: ['流式编码器', 'streaming encoder'], tdec: ['解码器', 'decoder'],
    dit: ['两步因果 DiT', 'Two-step Causal DiT'], ditSub: ['每块 4 帧 · 2 步去噪', '4 frames / chunk · 2 steps'],
    g: [['记忆', 'memory'], ['参考帧', 'refs'], ['历史', 'history'], ['当前', 'current']],
    rgb: ['RGB 画面 · 480×864', 'RGB frames · 480×864'], newf: ['新画面', 'new frames'], next: ['下一步操作', 'next action'],
    src: ['画面取自真实评测：07 金字塔 DMD 实验 DO 第 500 步，留出长例第 41 到 44 帧',
      'Frames from a real eval: 07 pyramid DMD run DO, step 500, held-out clip frames 41 to 44']
  };

  var CJK = /[　-〿㐀-鿿＀-￯]/, NON_CJK = /[^　-〿㐀-鿿＀-￯]+/g;
  var count = 0;
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { return x * x * (3 - 2 * x); }
  function easeOut(x) { return 1 - (1 - x) * (1 - x) * (1 - x); }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function hex(c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
  function mix(a, b, p) {
    var x = hex(a), y = hex(b);
    return 'rgb(' + x.map(function (v, i) { return Math.round(v + (y[i] - v) * p); }).join(',') + ')';
  }
  // 包络：a 起 0.12 秒升满，b 后 0.25 秒落回
  function env(t, a, b) { return t < a || t > b + 0.25 ? 0 : Math.min(clamp01((t - a) / 0.12), clamp01((b + 0.25 - t) / 0.25)); }
  function prog(t, a, b) { return t < a || t > b ? -1 : (t - a) / (b - a); }

  window.MG4Fig = window.MG4Fig || {};
  window.MG4Fig.loop = function (host) {
    var uid = 'mg4loop' + (++count);
    var o = [], A_ON = {}, PULSE = {};

    // ---------- 画图原语（与 make_fig.py 同名同参） ----------
    function st(fill, stroke, sw, extra) {
      return ' style="fill:' + fill + ';stroke:' + (stroke || 'none') + ';stroke-width:' + (sw || 0) + (extra || '') + '"';
    }
    function rect(x, y, w, h, fill, stroke, sw, rx, more) {
      o.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 0) + '"' +
        (more || '') + st(fill, stroke, sw) + '/>');
    }
    // 字重照 PNG 的观感：500 及以上的拉丁字母、数字、符号都是粗体，汉字一律常规字重
    function text1(x, y, s, size, fill, weight, anchor, lang) {
      var w = weight || 400, body = esc(s);
      if (w >= 500) w = Math.max(w, 600);
      if (w > 400 && CJK.test(s)) {
        body = s.replace(NON_CJK, function (m) { return m.trim() ? '<tspan style="font-weight:' + w + '">' + esc(m) + '</tspan>' : m; });
        w = 400;
      }
      o.push('<text x="' + x + '" y="' + y + '"' + (lang ? ' lang="' + lang + '"' : '') +
        ' style="font-size:' + size + 'px;font-weight:' + w + ';fill:' + fill +
        ';text-anchor:' + (anchor || 'start') + '">' + body + '</text>');
    }
    // 双语文字：中英相同只写一个，不同写两个 <text lang>；size 可写成 [中, 英]
    function tx(x, y, pair, size, fill, weight, anchor) {
      var sz = size instanceof Array ? size : [size, size];
      if (pair[0] === pair[1] && sz[0] === sz[1]) { text1(x, y, pair[0], sz[0], fill, weight, anchor); return; }
      text1(x, y, pair[0], sz[0], fill, weight, anchor, 'zh');
      text1(x, y, pair[1], sz[1], fill, weight, anchor, 'en');
    }
    function pts2(p) { return p.map(function (q) { return q[0] + ',' + q[1]; }).join(' '); }
    function pline(p, color, sw) { o.push('<polyline points="' + pts2(p) + '"' + st('none', color, sw) + '/>'); }
    function head(x, y, d, color) {
      var s = 9, h = 9 * 0.55, p = {
        r: [[x, y], [x - s, y - h], [x - s, y + h]], l: [[x, y], [x + s, y - h], [x + s, y + h]],
        u: [[x, y], [x - h, y + s], [x + h, y + s]], d: [[x, y], [x - h, y - s], [x + h, y - s]]
      }[d];
      o.push('<polygon points="' + pts2(p.map(function (q) { return [r3(q[0]), r3(q[1])]; })) + '"' + st(color) + '/>');
    }
    // 箭头：折线画到箭头根部，再画箭头；返回折线的点，给流动脉冲用
    function arrow(p, color, sw) {
      var a = p[p.length - 2], b = p[p.length - 1];
      var d = b[0] > a[0] ? 'r' : b[0] < a[0] ? 'l' : b[1] > a[1] ? 'd' : 'u';
      var tail = { r: [b[0] - 9, b[1]], l: [b[0] + 9, b[1]], d: [b[0], b[1] - 9], u: [b[0], b[1] + 9] }[d];
      var q = p.slice(0, -1).concat([tail]);
      pline(q, color, sw);
      head(b[0], b[1], d, color);
      return q;
    }
    // 流动脉冲：叠在连线上的一小段加粗线，沿线跑；几段之间可以留空（gap，与原图断开处一致）
    function flow(key, pieces, color, sw, gap) {
      var off = 0, total = 0;
      pieces.forEach(function (p, i) {
        var len = 0;
        for (var k = 1; k < p.length; k++) len += Math.abs(p[k][0] - p[k - 1][0]) + Math.abs(p[k][1] - p[k - 1][1]);
        if (i) off += gap || 0;
        o.push('<polyline data-p="' + key + '" data-len="' + len + '" data-off="' + off + '" points="' + pts2(p) + '"' +
          st('none', color, sw + 2.2, ';opacity:0') + '/>');
        off += len;
        total = off;
      });
      PULSE[key] = { total: total, seg: Math.max(14, Math.min(110, total * 0.45)) };
    }
    function farrow(key, p, color, sw) { flow(key, [arrow(p, color, sw)], color, sw); }
    // 高亮圈：与模块同形的描边，平时透明
    function ring(key, x, y, w, h, rx, color, sw) {
      o.push('<rect data-h="' + key + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '"' +
        st('none', color, sw, ';opacity:0') + '/>');
    }
    function img(x, y, w, h, name, border) {
      o.push('<image href="' + IMG + name + '.jpg" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
        '" preserveAspectRatio="none"/>');
      rect(x, y, w, h, 'none', border || '#5E666D', 0.8);
    }
    function gA(key, ton) { A_ON[key] = ton; o.push('<g data-a="' + key + '">'); }
    function gEnd() { o.push('</g>'); }
    function pill(cx, cy, pair, role, size, cjk, key) {
      [['zh', cjk], ['en', false]].forEach(function (v, i) {
        if (i && pair[0] === pair[1] && !cjk) return;
        var same = pair[0] === pair[1] && !cjk;
        var s = pair[i], w = s.length * size * (v[1] ? 1.0 : 0.6) + 22;
        o.push(same ? '<g>' : '<g lang="' + v[0] + '">');
        rect(r3(cx - w / 2), cy - 13, r3(w), 26, '#FFFFFF', role.stroke, 1.0, 13);
        text1(cx, r3(cy + size * 0.36), s, size, role.accent, 500, 'middle');
        if (key) ring(key, r3(cx - w / 2), cy - 13, r3(w), 26, 13, role.accent, 2.4);
        o.push('</g>');
      });
    }
    function card(x, y, w, h, role, title, sub, tsize, sw) {
      rect(x, y, w, h, role.fill, role.stroke, sw || 1.2, 8);
      rect(x + 22, y + 20, 26, 4, role.accent);
      tx(x + 22, y + 54, title, tsize || 20, INK, 600);
      tx(x + 22, y + 79, sub, 14, SUB, 400);
    }
    // 会动的层叠帧：5 张（4 张可见，1 张在后面候场），都放在最前一格，位置由 transform 给
    function stackAnim(name, x, y, w, h, frames) {
      o.push('<g data-s="' + name + '">');
      frames.forEach(function (f, j) { o.push('<g data-j="' + j + '">'); img(x, y, w, h, f); o.push('</g>'); });
      o.push('</g>');
    }

    // ---------- 整张图，次序与 make_loop.py 一致 ----------
    rect(0, 0, W, H, '#FFFFFF');

    // (A) 会话初始化
    rect(30, 30, 1620, 270, 'var(--panel)', 'var(--hair)', 1.0, 16);
    tx(54, 68, L.A, 22, INK, 700);
    tx(54, 92, L.Asub, 14, SUB);
    var AY = 175;
    gA('open', 0);
    img(240, AY - 50, 180, 100, 'open', STATE.accent);
    tx(330, AY + 74, L.open, 14, STATE.accent, 600, 'middle');
    ring('open', 240, AY - 50, 180, 100, 0, STATE.accent, 2.9);
    gEnd();
    gA('a1', 0.25); farrow('a1', [[420, AY], [470, AY]], STATE.accent, 1.6); gEnd();
    gA('imgm', 0.42); pill(530, AY, L.imgm, LOOK, 13, true, 'imgm'); gEnd();
    gA('a2', 0.6); farrow('a2', [[590, AY], [640, AY]], LOOK.accent, 1.6); gEnd();
    gA('refs', 0.72);
    for (var k = 2; k >= 0; k--) img(640 + 7 * k, AY - 44 - 7 * k, 170, 94, 'ref');
    ring('refs', 640, AY - 44, 170, 94, 0, LOOK.accent, 2.9);
    tx(740, AY + 74, L.refs, 14, LOOK.accent, 600, 'middle');
    gEnd();
    gA('prompt', 0.8); pill(740, AY - 78, L.prompt, LOOK, 13, false, 'prompt'); gEnd();
    gA('a3', 1.05); farrow('a3', [[838, AY], [900, AY]], LOOK.accent, 1.6); gEnd();
    gA('enc1', 1.2); pill(970, AY, L.enc1, LOOK, 13, true, 'enc1'); gEnd();
    gA('a4', 1.4); farrow('a4', [[1040, AY], [1150, AY]], LOOK.accent, 1.6); gEnd();
    gA('prefix', 1.58);
    rect(1150, AY - 70, 280, 140, LOOK.fill, LOOK.stroke, 1.4, 10);
    ring('prefix', 1150, AY - 70, 280, 140, 10, LOOK.accent, 2.9);
    tx(1290, AY - 44, L.prefix, 16, LOOK.accent, 700, 'middle');
    rect(1170, AY - 20, 130, 60, '#FFFFFF', LOOK.stroke, 1.0, 6);
    tx(1235, AY + 15, L.chip, [12, 11], LOOK.accent, 600, 'middle');
    tx(1310, AY + 15, ['+', '+'], 18, LOOK.accent, 700, 'middle');
    img(1322, AY - 18, 90, 50, 'ref', LOOK.accent);
    gEnd();

    // (B) 交互循环
    rect(30, 320, 1620, 570, 'var(--panel)', 'var(--hair)', 1.0, 16);
    tx(54, 358, L.B, 22, INK, 700);
    tx(54, 382, L.Bsub, 14, SUB);

    card(50, 640, 170, 110, NEUT, L.player, L.playerSub);
    ring('player', 50, 640, 170, 110, 8, SLATE, 2.7);
    farrow('pe', [[220, 710], [285, 710]], LINE, 1.8);

    // Harness：VLM 与代码游戏引擎
    rect(255, 410, 390, 400, '#FBFAFC', SEM.stroke, 2.0, 16, ' stroke-dasharray="7 5"');
    tx(275, 436, L.harness, 12, SEM.accent, 700);
    card(285, 452, 330, 168, SEM, L.vlm, L.vlmSub, 22, 2.0);
    L.chips.forEach(function (c, i) {
      var cx0 = 305 + (i % 2) * 150, cy0 = 545 + Math.floor(i / 2) * 36;
      rect(cx0, cy0, 140, 28, '#FFFFFF', SEM.stroke, 1.0, 6);
      tx(cx0 + 70, cy0 + 19, c, 12, SEM.accent, 600, 'middle');
    });
    ring('vlm', 285, 452, 330, 168, 8, SEM.accent, 3.3);
    card(285, 680, 330, 110, STATE, L.engine, L.engineSub);
    ring('engine', 285, 680, 330, 110, 8, STATE.accent, 3.1);
    farrow('reg', [[400, 620], [400, 680]], SEM.accent, 1.6);
    pill(400, 650, L.reg, SEM, 12, true, 'reg');
    farrow('ret', [[500, 680], [500, 620]], STATE.accent, 1.6);
    pill(500, 650, L.ret, STATE, 12, true, 'ret');

    // Harness 的两路输出
    farrow('ep', [[615, 735], [690, 735]], STATE.accent, 1.8);
    stackAnim('lp', 690, 712, 140, 78, ['lp41', 'lp42', 'lp43', 'lp44', 'lp41']);
    tx(778, 816, L.proxy, 13, STATE.accent, 600, 'middle');
    farrow('vc', [[615, 520], [700, 520]], SEM.accent, 1.8);
    rect(700, 500, 160, 40, SEM.fill, SEM.stroke, 1.2, 8);
    ring('cap', 700, 500, 160, 40, 8, SEM.accent, 2.7);
    tx(780, 526, L.cap, 13, SEM.accent, 600, 'middle');

    // 流式扩散渲染
    rect(900, 440, 600, 380, '#F2F3F5', SLATE, 1.6, 14);
    tx(920, 466, L.render, 13, SLATE, 700);
    farrow('cd', [[860, 520], [1150, 520], [1150, 600]], SEM.accent, 1.6);
    gA('pv', 1.85); farrow('pv', [[1290, 300], [1290, 600]], LOOK.accent, 1.8); gEnd();
    // 编码器
    rect(920, 640, 140, 150, '#FFFFFF', STATE.stroke, 1.2, 8);
    ring('enc', 920, 640, 140, 150, 8, STATE.accent, 2.9);
    tx(990, 668, L.taehv, 15, INK, 700, 'middle');
    tx(990, 690, L.tenc, 12, SUB, 400, 'middle');
    img(934, 712, 54, 30, 'lp41', STATE.accent);
    ring('encimg', 934, 712, 54, 30, 0, STATE.accent, 2.7);
    farrow('ei', [[992, 727], [1010, 727]], LINE, 1.2);
    for (k = 0; k < 2; k++) rect(1014 + k * 18, 720, 14, 14, '#A9B59E', 0, 0, 0, ' data-q="enc' + k + '"');
    farrow('pe2', [[838, 735], [920, 735]], STATE.accent, 1.8);
    farrow('ed', [[1060, 715], [1080, 715]], LINE, 1.6);
    // 两步因果 DiT（深色）
    rect(1080, 600, 250, 200, SLATE, SLATE, 1.6, 8);
    ring('dit', 1075, 595, 260, 210, 11, SLATE, 2.7);
    tx(1205, 638, L.dit, 18, '#FFFFFF', 700, 'middle');
    tx(1205, 662, L.ditSub, 12, '#C9D0D6', 400, 'middle');
    // 注意力上下文方格：记忆、参考帧不动；历史与当前在裁剪框里整条平移
    o.push('<clipPath id="' + uid + 'c"><rect x="1191" y="695" width="107" height="23"/></clipPath>');
    var x = 1098, labels = [];
    for (k = 0; k < 3; k++, x += 16) rect(x, 700, 13, 13, 'var(--rose)');
    labels.push([1098, x]); x += 8;
    gA('kvref', 2.25);
    for (k = 0; k < 2; k++, x += 16) rect(x, 700, 13, 13, LOOK.accent);
    gEnd();
    labels.push([labels[0][1] + 8, x]); x += 8;
    o.push('<g clip-path="url(#' + uid + 'c)">');
    for (k = 0; k < 5; k++, x += 16) rect(x, 700, 13, 13, HIST, 0, 0, 0, ' data-q="kv' + k + '"');
    labels.push([labels[1][1] + 8, x]); x += 8;
    rect(x, 700, 13, 13, CUR, 0, 0, 0, ' data-q="kvc"');
    rect(x + 24, 700, 13, 13, NOISY, 0, 0, 0, ' data-q="kvn"');
    labels.push([x, x + 16]);
    o.push('</g>');
    labels.forEach(function (lb, i) { tx((lb[0] + lb[1] - 3) / 2, 738, L.g[i], 11, '#C9D0D6', 400, 'middle'); });
    farrow('dd', [[1330, 715], [1350, 715]], LINE, 1.6);
    // 解码器
    rect(1350, 640, 136, 150, '#FFFFFF', NEUT.stroke, 1.2, 8);
    ring('dec', 1350, 640, 136, 150, 8, SLATE, 2.9);
    tx(1418, 668, L.taehv, 15, INK, 700, 'middle');
    tx(1418, 690, L.tdec, 12, SUB, 400, 'middle');
    for (k = 0; k < 2; k++) rect(1362 + k * 18, 720, 14, 14, HIST);
    farrow('di', [[1398, 727], [1414, 727]], LINE, 1.2);
    o.push('<g data-q="decimg">'); img(1418, 712, 54, 30, 'gen41'); o.push('</g>');
    // RGB 画面
    farrow('dr', [[1486, 715], [1520, 715]], SLATE, 1.8);
    stackAnim('gen', 1520, 682, 112, 62, ['gen41', 'gen42', 'gen43', 'gen44', 'gen41']);
    tx(1580, 776, L.rgb, 12, INK, 600, 'middle');

    // 回路：下一步操作回到玩家；新画面回到 VLM（与外观前缀竖线相交处断开 20）
    farrow('na', [[1580, 784], [1580, 860], [135, 860], [135, 750]], LINE, 1.6);
    pill(860, 860, L.next, NEUT, 12, true, 'na');
    var nf1 = [[1600, 662], [1600, 395], [1300, 395]];
    pline(nf1, SEM.accent, 1.6);
    flow('nf', [nf1, arrow([[1280, 395], [630, 395], [630, 470], [615, 470]], SEM.accent, 1.6)], SEM.accent, 1.6, 20);
    pill(1120, 395, L.newf, SEM, 12, true, 'nf');

    tx(1636, 908, L.src, 11, SUB, 400, 'end');

    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
      '" role="img" aria-label="Interaction loop" style="width:100%;height:auto;display:block;font-family:var(--font)">' +
      o.join('') + '</svg>';

    // ---------- 动画 ----------
    var svg = host.firstChild;
    function all(sel) { return Array.prototype.slice.call(svg.querySelectorAll(sel)); }
    function group(attr) {
      var m = {};
      all('[' + attr + ']').forEach(function (el) { var k = el.getAttribute(attr); (m[k] = m[k] || []).push(el); });
      return m;
    }
    var GA = group('data-a'), GH = group('data-h'), GP = group('data-p');
    var Q = {};
    all('[data-q]').forEach(function (el) { Q[el.getAttribute('data-q')] = el; });
    GP = Object.keys(GP).reduce(function (m, k) {
      m[k] = GP[k].map(function (el) { return { el: el, len: +el.getAttribute('data-len'), off: +el.getAttribute('data-off') }; });
      return m;
    }, {});
    var STK = {};
    ['lp', 'gen'].forEach(function (n) {
      STK[n] = all('[data-s="' + n + '"] > g');
      STK[n].forEach(function (el) { el.j = +el.getAttribute('data-j'); });
    });

    // 只在值变了时写 DOM
    function css(el, p, v) { if (el['_' + p] !== v) { el['_' + p] = v; el.style.setProperty(p, v); } }
    function att(el, p, v) { if (el['_a' + p] !== v) { el['_a' + p] = v; el.setAttribute(p, v); } }
    function op(el, v) { css(el, 'opacity', String(r3(v))); }

    function pulse(key, p) {
      var info = PULSE[key], seg = info.seg, h = p * (info.total + seg);
      GP[key].forEach(function (it) {
        var lh = h - it.off;
        if (p < 0 || lh <= 0 || lh - seg >= it.len) { op(it.el, 0); return; }
        op(it.el, 1);
        att(it.el, 'stroke-dasharray', seg + ' ' + (it.len + seg + 10));
        att(it.el, 'stroke-dashoffset', String(r3(seg - lh)));
      });
    }
    // 层叠帧往前推：第 j 张的槽位 = (j - k) mod 5 - u，0 是最前，3 是最后一张可见，4 在后面候场
    function stack(name, eff, off) {
      var els = STK[name], n = els.length, k = Math.floor(eff + 1e-6), u = Math.max(0, eff - k);
      if (els._k !== k) {
        els._k = k;
        els.slice().sort(function (a, b) { return mod(b.j - k, n) - mod(a.j - k, n); })
          .forEach(function (el) { el.parentNode.appendChild(el); });
      }
      els.forEach(function (el) {
        var s = mod(el.j - k, n) - u, d = s >= 0 ? off * s : 2 * off * s;
        att(el, 'transform', 'translate(' + r3(d) + ' ' + r3(-d) + ')');
        op(el, s >= 0 ? clamp01(n - 1 - s) : clamp01(1 + s));
      });
    }
    function pushes(tc, cyc, start, dur) {
      var e = cyc * 2;
      for (var c = 0; c < 2; c++) e += ease(clamp01((tc - (A_END + c * D + start)) / dur));
      return e;
    }
    function sq(el, cx, cy, s, v) {
      att(el, 'transform', s === 1 ? '' : 'translate(' + cx + ' ' + cy + ') scale(' + r3(s) + ') translate(' + -cx + ' ' + -cy + ')');
      op(el, v);
    }

    // t 为 null 时画静止的完整状态（与 PNG 相同）
    function render(t) {
      var still = t == null;
      var tc = still ? 0 : t % T, cyc = still ? 0 : Math.floor(t / T);
      var c = !still && tc >= A_END ? Math.min(1, Math.floor((tc - A_END) / D)) : -1;
      var u = c >= 0 ? tc - A_END - c * D : -9;
      var R = {}, P = {}, k;

      // (A) 依次点亮，之后保持；一圈最后 0.4 秒淡回，下一圈重新走
      var endf = clamp01((T - 0.1 - tc) / 0.4);
      for (k in GA) {
        var v = still ? 1 : DIM + (1 - DIM) * clamp01((tc - A_ON[k]) / 0.3) * endf;
        GA[k].forEach(function (el) { op(el, v); });
      }
      if (!still) {
        R.open = env(tc, 0, 0.3); R.imgm = env(tc, 0.42, 0.62); R.refs = env(tc, 0.74, 1.0); R.prompt = env(tc, 0.8, 1.0);
        R.enc1 = env(tc, 1.2, 1.42); R.prefix = env(tc, 1.58, 1.9); R.dit = env(tc, 2.22, 2.3);
        P.a1 = prog(tc, 0.25, 0.45); P.a2 = prog(tc, 0.6, 0.76); P.a3 = prog(tc, 1.05, 1.22);
        P.a4 = prog(tc, 1.4, 1.6); P.pv = prog(tc, 1.85, 2.3);
      }
      // (B) 一块之内：玩家 → 引擎（注册、检索）→ 低模画面 → 编码 → DiT → 解码 → RGB → 回到玩家与 VLM
      if (c >= 0) {
        R.player = env(u, 0, 0.45); P.pe = prog(u, 0, 0.33);
        R.vlm = R.engine = env(u, 0.3, 1.25);
        P.reg = prog(u, 0.38, 0.62); R.reg = env(u, 0.38, 0.62);
        P.ret = prog(u, 0.72, 0.96); R.ret = env(u, 0.72, 0.96);
        P.vc = prog(u, 0.4, 0.6); R.cap = env(u, 0.58, 0.95); P.cd = prog(u, 0.8, 1.5);
        P.ep = prog(u, 1.05, 1.28);
        P.pe2 = prog(u, 1.6, 1.85);
        R.enc = env(u, 1.8, 2.4); R.encimg = env(u, 1.85, 2.05); P.ei = prog(u, 1.95, 2.08);
        P.ed = prog(u, 2.3, 2.45);
        R.dit = Math.max(R.dit, env(u, 2.4, 3.35));
        P.dd = prog(u, 3.3, 3.45);
        R.dec = env(u, 3.42, 3.95); P.di = prog(u, 3.55, 3.66);
        P.dr = prog(u, 3.8, 3.95);
        P.na = prog(u, 4.1, 4.8); R.na = env(u, 4.36, 4.5);
        P.nf = prog(u, 4.1, 4.75); R.nf = env(u, 4.38, 4.52);
      }
      for (k in GH) { var rv = R[k] || 0; GH[k].forEach(function (el) { op(el, rv); }); }
      for (k in GP) pulse(k, P[k] == null ? -1 : P[k]);

      stack('lp', still ? 0 : pushes(tc, cyc, 1.25, 0.45), 6);
      stack('gen', still ? 0 : pushes(tc, cyc, 3.9, 0.4), 5);

      // 编码器：小图进来，两个方格依次出现
      for (k = 0; k < 2; k++) {
        var pop = 2.06 + 0.1 * k, s = 1, a = 1;
        if (u >= 1.8 && u < pop + 0.14) {
          if (u < 1.9) a = 1 - (u - 1.8) / 0.1;
          else if (u < pop) a = 0;
          else { a = (u - pop) / 0.14; s = easeOut(a); }
        }
        sq(Q['enc' + k], 1021 + 18 * k, 727, s, a);
      }
      // 解码器：方格变回小图
      var di = 1;
      if (u >= 3.42 && u < 3.82) di = u < 3.5 ? 1 - (u - 3.42) / 0.08 : u < 3.66 ? 0 : (u - 3.66) / 0.16;
      op(Q.decimg, di);

      // KV 方格：历史整条左移一格，最旧的从左出，上一块的当前并入历史，新块从右进，两步去噪由深变浅
      var roll = u >= 2.45 && u < 3.3, m = roll ? ease(clamp01((u - 2.45) / 0.45)) : 0;
      for (k = 0; k < 5; k++) {
        att(Q['kv' + k], 'transform', m ? 'translate(' + r3(-16 * m) + ' 0)' : '');
        op(Q['kv' + k], k === 0 ? 1 - m : 1);
      }
      att(Q.kvc, 'transform', m ? 'translate(' + r3(-24 * m) + ' 0)' : '');
      css(Q.kvc, 'fill', roll ? mix(CUR, HIST, m) : CUR);
      att(Q.kvn, 'transform', m ? 'translate(' + r3(-24 * m) + ' 0)' : '');
      op(Q.kvn, roll ? m : 0);
      if (roll) {
        var d1 = clamp01((u - 3.0) / 0.12), d2 = clamp01((u - 3.18) / 0.12);
        css(Q.kvn, 'fill', d2 > 0 ? mix(MID, CUR, d2) : mix(NOISY, MID, d1));
      }
    }

    // ---------- 播放控制 ----------
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var acc = 0, last = null, raf = 0, playing = false;
    function frame(now) {
      if (last != null) acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      render(acc);
      raf = requestAnimationFrame(frame);
    }
    function play() {
      if (playing || reduced) return;
      playing = true; last = null;
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      playing = false;
      cancelAnimationFrame(raf);
    }
    render(reduced ? null : 0);
    play();
    return { play: play, pause: pause };
  };
})();
