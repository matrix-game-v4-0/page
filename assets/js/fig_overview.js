/* 方法图「系统总览」动画组件：复刻 assets/fig/overview_<lang>.png。
   几何、配色照出图脚本 artifacts/method_fig_1012/make_fig_v4.py 逐项搬过来（画布 1800×1000，与 PNG 同比例）；
   文字按 make_fig_v5.py，即 PR 稿「路线」一节更新后带 Coding Agent 的画板（10-14 对齐）。
   动画沿数据流向一圈 10 秒，每帧状态只由时间算出，所以首尾接得上、暂停后接着播：
     0.0–1.5 s  用户指令、玩家两框依次亮，点流入 Harness
     1.0–3.0 s  Coding Agent 与游戏引擎之间「修改」「检索」交替，小地图里的角色走一步
     2.7–4.6 s  语义条件逐段写出、低模代理画面叠帧前推、三张参考帧依次亮
     4.4–6.4 s  三路条件汇入 DiT；DiT 的块与注意力窗口左移一格，新块两步去噪
     6.0–8.4 s  画面叠帧前推，「新画面」沿闭环线回到 Coding Agent
     6.4–9.6 s  当前块写入空间记忆，相机位姿到达，按 K/V 取回 3 帧，记忆格抬起
   prefers-reduced-motion 时停在与 PNG 相同的静态状态。 */
(function () {
  'use strict';
  var T = 10;
  var seq = 0;

  var INK = 'var(--ink)', SUB = 'var(--sub)', LINE = '#8F969C', HAIR = 'var(--hair)';
  var STATE = { fill: 'var(--sage-l)', stroke: '#97A38D', accent: 'var(--sage)' };
  var SEM = { fill: 'var(--mauve-l)', stroke: '#A398AE', accent: 'var(--mauve)' };
  var LOOK = { fill: 'var(--sand-l)', stroke: '#BCAA8E', accent: 'var(--sand)' };
  var MEM = { fill: 'var(--rose-l)', stroke: '#C2A19A', accent: 'var(--rose)' };
  var OURS = { fill: 'var(--slate)', stroke: 'var(--slate)', accent: '#D8C7AA' };
  var NEUT = { fill: '#FFFFFF', stroke: '#A9AFB4', accent: LINE };
  var SW1 = 3.0, SW2 = 2.2;

  // 胶囊标签宽度：Noto Sans CJK Bold 21px 实量字宽，与 PNG 一致（修改、Register、Retrieval 为 10-14 按同口径补量）
  var PILLW = { '注册': 42, '修改': 42, 'Register': 83.6, 'Retrieval': 88.4, '检索': 42, '新画面': 63, '写入': 42, '相机位姿': 84, 'K/V': 38.3,
    'register': 78.2, 'retrieval': 83, 'new frames': 117.8, 'write': 51.3, 'camera pose': 129.5 };

  function n(v) { return Math.round(v * 10) / 10; }
  function rect(x, y, w, h, fill, stroke, sw, rx, extra) {
    return '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '"' +
      (rx ? ' rx="' + rx + '"' : '') + (extra || '') + ' style="fill:' + fill +
      (stroke ? ';stroke:' + stroke + ';stroke-width:' + sw : '') + '"/>';
  }
  function line(x1, y1, x2, y2, col, sw, dash) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" style="stroke:' + col +
      ';stroke-width:' + sw + (dash ? ';stroke-dasharray:' + dash : '') + '"/>';
  }
  function pline(pts, col, sw, dash, extra) {
    return '<polyline points="' + pts.map(function (p) { return n(p[0]) + ',' + n(p[1]); }).join(' ') + '"' + (extra || '') +
      ' style="fill:none;stroke:' + col + ';stroke-width:' + sw + (dash ? ';stroke-dasharray:' + dash : '') + '"/>';
  }
  function circle(cx, cy, r, fill, stroke, sw, extra) {
    return '<circle cx="' + n(cx) + '" cy="' + n(cy) + '" r="' + n(r) + '"' + (extra || '') + ' style="fill:' + fill +
      (stroke ? ';stroke:' + stroke + ';stroke-width:' + sw : '') + '"/>';
  }
  function tri(cx, top, base, half, fill) {
    return '<path d="M' + n(cx) + ' ' + n(top) + 'L' + n(cx + half) + ' ' + n(base) + 'L' + n(cx - half) + ' ' + n(base) +
      'Z" style="fill:' + fill + '"/>';
  }
  function text(x, y, s, size, fill, weight, anchor, extra) {
    return '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + size + '" font-weight="' + weight + '"' +
      (anchor && anchor !== 'start' ? ' text-anchor="' + anchor + '"' : '') + (extra || '') +
      ' style="fill:' + fill + '">' + s + '</text>';
  }
  // 中英两份文字，页面 CSS 只显示当前语言；maxw 给溢出兜底（见 fit）
  function text2(x, y, zh, en, size, fill, weight, anchor, maxw, extra) {
    var w = maxw ? ' data-w="' + maxw + '"' : '';
    if (zh === en) return text(x, y, zh, size, fill, weight, anchor, w + (extra || ''));
    return text(x, y, zh, size, fill, weight, anchor, ' lang="zh"' + w + (extra || '')) +
      text(x, y, en, size, fill, weight, anchor, ' lang="en"' + w + (extra || ''));
  }
  // 直角折线加实心三角箭头，箭头方向由最后一段决定
  function head(x, y, d, col, s) {
    var h = s * 0.55, p = {
      r: [[x, y], [x - s, y - h], [x - s, y + h]], l: [[x, y], [x + s, y - h], [x + s, y + h]],
      u: [[x, y], [x - h, y + s], [x + h, y + s]], d: [[x, y], [x - h, y - s], [x + h, y - s]] }[d];
    return '<polygon points="' + p.map(function (q) { return n(q[0]) + ',' + n(q[1]); }).join(' ') + '" style="fill:' + col + '"/>';
  }
  function arrow(pts, col, sw, dash, hs, extra) {
    hs = hs || 16;
    var a = pts[pts.length - 2], b = pts[pts.length - 1];
    var d = b[0] > a[0] ? 'r' : b[0] < a[0] ? 'l' : b[1] > a[1] ? 'd' : 'u';
    var tail = { r: [b[0] - hs, b[1]], l: [b[0] + hs, b[1]], d: [b[0], b[1] - hs], u: [b[0], b[1] + hs] }[d];
    return pline(pts.slice(0, -1).concat([tail]), col, sw, dash, extra) + head(b[0], b[1], d, col, hs);
  }

  // ---------- 小插图（同 make_fig.py） ----------
  function lowpoly(x, y, w, h) {
    var e = '#6E757B', s = rect(x, y, w, h, '#ECEEEF', e, 0.8) + rect(x, y + h * 0.58, w, h * 0.42, '#D2D5D7');
    for (var i = 0; i < 4; i++) s += rect(x + w * (0.40 + 0.15 * i), y + h * (0.70 + 0.12 * (i % 2)), w * 0.075, h * 0.12, '#DEE1E3');
    return s + rect(x, y, w * 0.32, h * 0.80, '#C9B79C', e, 0.6) +
      rect(x + w * 0.44, y + h * 0.30, w * 0.12, h * 0.30, '#A79FB1', e, 0.6) +
      rect(x + w * 0.62, y + h * 0.40, w * 0.38, h * 0.18, '#A9B59E', e, 0.6) +
      rect(x + w * 0.735, y + h * 0.22, w * 0.025, h * 0.22, '#8C8478') +
      circle(x + w * 0.75, y + h * 0.20, h * 0.13, '#9AAA90', e, 0.6) +
      rect(x + w * 0.20, y + h * 0.62, w * 0.10, h * 0.20, '#8FA1AE', e, 0.6) +
      rect(x + w * 0.22, y + h * 0.48, w * 0.08, h * 0.14, '#B7A98D', e, 0.6);
  }
  function rich(x, y, w, h) {
    var s = rect(x, y, w, h, '#DCE4EA', '#5E666D', 0.8) + rect(x + 0.5, y + h * 0.20, w - 1, h * 0.22, '#E6ECF0') +
      tri(x + w * 0.55, y + h * 0.18, y + h * 0.56, w * 0.24, '#A9B5BE') +
      tri(x + w * 0.82, y + h * 0.10, y + h * 0.56, w * 0.22, '#9AA7B1') +
      tri(x + w * 0.82, y + h * 0.10, y + h * 0.20, w * 0.048, '#F4F6F7') +
      rect(x + 0.5, y + h * 0.55, w - 1, h * 0.45 - 0.5, '#8E9C78');
    for (var i = 0; i < 5; i++) {
      var gx = x + w * (0.42 + 0.11 * i);
      s += line(n(gx), n(y + h * (0.86 - 0.04 * (i % 2))), n(gx), n(y + h * (0.76 - 0.04 * (i % 2))), '#6F7D5D', 0.8);
    }
    s += rect(x + 0.5, y + 0.5, w * 0.32, h * 0.80, '#B9A78B');
    for (var k = 1; k < 6; k++) s += line(n(x + 0.5), n(y + h * 0.13 * k), n(x + w * 0.32), n(y + h * 0.13 * k), '#9C8B72', 0.6);
    return s + rect(x + w * 0.735, y + h * 0.24, w * 0.025, h * 0.30, '#7A6F63') +
      circle(x + w * 0.71, y + h * 0.24, h * 0.11, '#7F9070') + circle(x + w * 0.79, y + h * 0.20, h * 0.12, '#93A383') +
      circle(x + w * 0.75, y + h * 0.12, h * 0.10, '#859676') + rect(x + w * 0.21, y + h * 0.60, w * 0.07, h * 0.22, '#B98F86') +
      circle(x + w * 0.245, y + h * 0.55, h * 0.06, '#E2C9B8') + rect(x + w * 0.208, y + h * 0.82, w * 0.03, h * 0.08, '#5E666D') +
      rect(x + w * 0.252, y + h * 0.82, w * 0.03, h * 0.08, '#5E666D');
  }
  function portrait(x, y, w, h) {
    return rect(x, y, w, h, '#E9E1D6', '#5E666D', 0.8) + rect(x + w * 0.36, y + h * 0.52, w * 0.28, h * 0.48, '#B98F86') +
      circle(x + w * 0.5, y + h * 0.36, h * 0.17, '#E2C9B8') + rect(x + w * 0.40, y + h * 0.14, w * 0.20, h * 0.08, '#7A6F63');
  }
  function landscape(x, y, w, h) {
    return rect(x, y, w, h, '#DCE4EA', '#5E666D', 0.8) + tri(x + w * 0.32, y + h * 0.22, y + h * 0.62, w * 0.30, '#A9B5BE') +
      tri(x + w * 0.68, y + h * 0.12, y + h * 0.62, w * 0.32, '#9AA7B1') +
      tri(x + w * 0.68, y + h * 0.12, y + h * 0.22, w * 0.064, '#F4F6F7') + rect(x + 0.5, y + h * 0.60, w - 1, h * 0.40 - 0.5, '#8E9C78');
  }

  // ---------- 动画用的小工具 ----------
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { x = clamp(x); return x * x * (3 - 2 * x); }
  function sine(x) { x = clamp(x); return 0.5 - 0.5 * Math.cos(Math.PI * x); }
  function env(t, win, ri, ro) {
    var o = 0;
    for (var i = 0; i < win.length; i++) {
      var a = win[i][0], b = win[i][1];
      if (t >= a && t <= b) o = Math.max(o, Math.min(ease((t - a) / ri), ease((b - t) / ro)));
    }
    return o;
  }
  function rgb(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(a, b, p) {
    a = rgb(a); b = rgb(b); p = clamp(p);
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * p) + ',' + Math.round(a[1] + (b[1] - a[1]) * p) + ',' +
      Math.round(a[2] + (b[2] - a[2]) * p) + ')';
  }
  function path(pts) {
    var L = [0];
    for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]));
    return { pts: pts, L: L, tot: L[L.length - 1] };
  }
  function pointAt(p, f) {
    var d = f * p.tot;
    for (var i = 1; i < p.pts.length; i++) {
      if (d <= p.L[i] || i === p.pts.length - 1) {
        var s = clamp((d - p.L[i - 1]) / ((p.L[i] - p.L[i - 1]) || 1)), a = p.pts[i - 1], b = p.pts[i];
        return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
      }
    }
  }

  window.MG4Fig = window.MG4Fig || {};
  window.MG4Fig.overview = function (host) {
    var P = 'mg4ov' + (seq++) + '-';
    var s = '', rings = '', dotsSvg = '', pills = '';
    var glows = [];      // { k, win, ri, ro }：按时间窗淡入淡出的高亮层
    var dots = [];       // { k, path, win }：沿连线走的小点

    function ring(k, x, y, w, h, col, win, sw, rx) {
      rings += rect(x, y, w, h, 'none', col, sw || 3.4, rx || 10, ' data-k="' + k + '" opacity="0"');
      glows.push({ k: k, win: win, ri: 0.22, ro: 0.4 });
    }
    function dot(k, pts, col, win, hollow) {
      dotsSvg += hollow ? circle(pts[0][0], pts[0][1], 8, '#FFFFFF', col, 2.8, ' data-k="' + k + '" opacity="0"')
        : circle(pts[0][0], pts[0][1], 8, col, '#FFFFFF', 1.8, ' data-k="' + k + '" opacity="0"');
      dots.push({ k: k, path: path(pts), win: win });
    }
    function card(k, x, y, w, h, role, tz, te, sz, se, o) {
      o = o || {};
      var ts = o.ts || 32, dark = !!o.dark;
      s += rect(x, y, w, h, role.fill, role.stroke, o.sw || (dark ? 2.4 : 1.8), 10) + rect(x + 22, y + 20, 34, 6, role.accent);
      var ty = y + 26 + ts + 8, sy = ty + 22 + 12;
      s += text2(x + 22, ty, tz, te, ts, dark ? '#FFFFFF' : INK, 700, 'start', w - 44);
      s += text2(x + 22, sy, sz, se, 22, dark ? '#C9D0D6' : SUB, 400, 'start', w - 44);
      if (o.win) ring('r-' + k, x, y, w, h, o.ring || role.accent, o.win);
      return sy;
    }
    function pill(k, cx, cy, zh, en, role, win) {
      [[zh, 'zh'], [en, 'en']].forEach(function (q, i) {
        if (i === 1 && zh === en) return;
        var w = PILLW[q[0]] + 30, x = cx - w / 2, y = cy - 17.5;
        pills += '<g' + (zh === en ? '' : ' lang="' + q[1] + '"') + '>' + rect(x, y, w, 35, '#FFFFFF', role.stroke, 1.6, 17.5) +
          rect(x, y, w, 35, role.fill, role.accent, 2.2, 17.5, ' data-k="' + k + '" opacity="0"') +
          text(cx, cy + 21 * 0.36, q[0], 21, role.accent, 700, 'middle') + '</g>';
      });
      glows.push({ k: k, win: win, ri: 0.15, ro: 0.3 });
    }
    // 叠帧：后两张空白帧加最前面一张插图；前推时整摞往左下走一格，最前那张淡出，新的一张从最后补上
    function stack(k, x, y, w, h, off, thumb) {
      function back(dk, extra) { return '<g data-k="' + k + extra + '">' + rect(x + off * dk, y - off * dk, w, h, '#F5F6F7', '#B7BDC2', 1.0) + '</g>'; }
      s += back(2, 'n').replace('<g ', '<g opacity="0" ') + back(2, '2') + back(1, '1') +
        '<g data-k="' + k + 't2" opacity="0">' + thumb(x, y, w, h) + '</g><g data-k="' + k + 't">' + thumb(x, y, w, h) + '</g>';
    }

    s += rect(0, 0, 1800, 1000, '#FFFFFF');
    // 四列抬头
    [[30, 230, '输  入', 'INPUT'], [270, 710, 'Harness', 'HARNESS'], [770, 1110, '条 件 接 口', 'INTERFACE'],
      [1180, 1770, '生 成 式 渲 染', 'RENDERING']].forEach(function (c) {
      s += text2(c[0], 50, c[2], c[3], 22, LINE, 700, 'start', 0, ' xml:space="preserve"') + line(c[0], 66, c[1], 66, HAIR, 1.4);
    });

    // ---------- Harness：Coding Agent 与游戏引擎合在一个虚线框里 ----------
    s += rect(270, 128, 440, 622, '#FAF9FB', SEM.stroke, 2.6, 18, ' data-k="hbox" stroke-dasharray="9 6"');
    s += text2(292, 162, 'Harness：Coding Agent + 游戏引擎', 'HARNESS: Coding Agent + GAME ENGINE', 20, SEM.accent, 700, 'start', 396);

    var sb = card('vlm', 290, 185, 400, 175, SEM, 'Coding Agent', 'Coding Agent', '新的规则与推理想象', 'Directing beyond rules',
      { sw: 2.8, win: [[0.75, 2.9], [8.3, 9.2]] });
    [['转述细化提示词', 'New Prompts', [[2.55, 3.2]]], ['新的规则', 'New Mechanisms', [[0.95, 1.5], [1.95, 2.5]]]].forEach(function (c, i) {
      var x0 = 312 + i * 184;
      s += rect(x0, sb + 14, 172, 40, '#FFFFFF', SEM.stroke, 1.6, 8) +
        rect(x0, sb + 14, 172, 40, SEM.fill, SEM.accent, 2.2, 8, ' data-k="chip' + i + '" opacity="0"') +
        text2(x0 + 86, sb + 41, c[0], c[1], 20, SEM.accent, 700, 'middle', 162);
      glows.push({ k: 'chip' + i, win: c[2], ri: 0.15, ro: 0.3 });
    });

    sb = card('eng', 290, 450, 400, 270, STATE, '游戏引擎', 'Game Engine', '规则之内的状态演化', 'Rule-based state',
      { win: [[0.95, 3.1]] });
    // 俯视关卡图加三条状态量（level_map，k = 1.3）
    var mx0 = 312, my0 = sb + 22, K = 1.3;
    s += rect(mx0, my0, 160 * K, 70 * K, '#F4F5F2', '#B5BDAE', 1.0);
    for (var i = 1; i < 8; i++) s += line(n(mx0 + 20 * K * i), my0, n(mx0 + 20 * K * i), n(my0 + 70 * K), '#E2E6DD', 0.8);
    for (var j = 1; j < 4; j++) s += line(mx0, n(my0 + 17.5 * K * j), n(mx0 + 160 * K), n(my0 + 17.5 * K * j), '#E2E6DD', 0.8);
    [[20, 17, 50, 7], [60, 17, 7, 32], [100, 40, 40, 7], [20, 52, 7, 18]].forEach(function (q) {
      s += rect(mx0 + q[0] * K, my0 + q[1] * K, q[2] * K, q[3] * K, '#A9B2A1');
    });
    s += tri(mx0 + 46 * K, my0 + 32 * K, my0 + 39 * K, 5 * K, STATE.accent) + circle(mx0 + 46 * K, my0 + 45 * K, 5 * K, STATE.accent);
    [[126, 18], [86, 60]].forEach(function (q) { s += rect(mx0 + (q[0] - 4) * K, my0 + (q[1] - 4) * K, 8 * K, 8 * K, '#C9B79C'); });
    s += circle(mx0 + 136 * K, my0 + 60 * K, 4.5 * K, '#B98F86', 0, 0, ' data-k="npc"');
    [0.85, 0.55, 0.7].forEach(function (f, i) {
      s += rect(mx0 + 178 * K, my0 + (12 + 20 * i) * K, 40 * K, 7 * K, '#E2E6DD') +
        rect(mx0 + 178 * K, my0 + (12 + 20 * i) * K, 40 * K * f, 7 * K, STATE.stroke, 0, 0, 0, i === 0 ? ' data-k="bar0"' : '');
    });

    s += arrow([[420, 360], [420, 450]], SEM.accent, SW2);
    pill('p-reg', 420, 405, '修改', 'Register', SEM, [[1.0, 1.5], [2.0, 2.5]]);
    s += arrow([[560, 450], [560, 360]], STATE.accent, SW2);
    pill('p-ret', 560, 405, '检索', 'Retrieval', STATE, [[1.5, 2.0], [2.5, 3.0]]);
    dot('d-reg1', [[420, 360], [420, 450]], SEM.accent, [1.05, 1.45]);
    dot('d-ret1', [[560, 450], [560, 360]], STATE.accent, [1.55, 1.95]);
    dot('d-reg2', [[420, 360], [420, 450]], SEM.accent, [2.05, 2.45]);
    dot('d-ret2', [[560, 450], [560, 360]], STATE.accent, [2.55, 2.95]);

    // ---------- 输入 ----------
    card('ins', 30, 210, 200, 120, NEUT, '用户指令', 'Instruction', '“我要无敌模式”', '“Godmode”', { ts: 28, win: [[0, 1.0]], ring: SUB });
    s += arrow([[230, 270], [290, 270]], LINE, SW2);
    card('ply', 30, 525, 200, 120, NEUT, '玩家', 'Player', 'WASD · 射击', 'WASD · Shoot', { ts: 28, win: [[0.45, 1.45]], ring: SUB });
    s += arrow([[230, 585], [290, 585]], LINE, SW2);
    dot('d-ins', [[230, 270], [290, 270]], LINE, [0.3, 0.75]);
    dot('d-ply', [[230, 585], [290, 585]], LINE, [0.75, 1.2]);

    // ---------- 条件接口：颜色跟来源走 ----------
    sb = card('pr', 770, 185, 340, 150, SEM, '提示词', 'Semantic Prompts', '当前状态+用户意图', 'Current state & User preference',
      { win: [[2.95, 4.6]] });
    for (i = 0; i < 11; i++) s += rect(792 + i * 27, sb + 18, 23, 8, i % 2 === 0 ? SEM.stroke : '#D8D1DE', 0, 0, 0, ' data-k="st' + i + '"');
    s += arrow([[690, 260], [770, 260]], SEM.accent, SW1);
    dot('d-pr', [[690, 260], [770, 260]], SEM.accent, [2.75, 3.15]);

    sb = card('ref', 770, 355, 340, 190, LOOK, '多参考帧', 'Reference Frames', '锚定角色、场景与画风', 'Characters, scenes, style',
      { win: [[3.3, 4.6]] });
    s += portrait(792, sb + 18, 90, 50) + landscape(892, sb + 18, 90, 50) + rich(992, sb + 18, 90, 50);
    [0, 1, 2].forEach(function (q) {
      ring('rt' + q, 792 + q * 100, sb + 18, 90, 50, LOOK.accent, [[3.45 + 0.3 * q, 3.95 + 0.3 * q]], 2.6, 1);
    });

    sb = card('px', 770, 565, 340, 210, STATE, '低模代理画面', 'Low-poly Proxy', '逐帧稠密控制', 'Dense, every frame',
      { win: [[3.25, 4.6]] });
    stack('sp', 792, sb + 30, 120, 66, 8, lowpoly);
    s += arrow([[690, 670], [770, 670]], STATE.accent, SW1);
    dot('d-px', [[690, 670], [770, 670]], STATE.accent, [2.95, 3.35]);

    // 三路条件汇到总线再进 DiT
    s += line(1110, 260, 1145, 260, SEM.accent, SW2) + line(1110, 450, 1145, 450, LOOK.accent, SW2) +
      line(1110, 670, 1145, 670, STATE.accent, SW1) + line(1145, 260, 1145, 670, LINE, SW2);
    s += arrow([[1145, 450], [1180, 450]], LINE, SW1);
    dot('d-b1', [[1110, 260], [1145, 260], [1145, 450], [1180, 450]], SEM.accent, [4.4, 5.0]);
    dot('d-b2', [[1110, 450], [1180, 450]], LOOK.accent, [4.82, 5.0]);
    dot('d-b3', [[1110, 670], [1145, 670], [1145, 450], [1180, 450]], STATE.accent, [4.4, 5.0]);

    // ---------- 生成式渲染 ----------
    sb = card('dit', 1180, 350, 300, 200, OURS, '因果自回归 DiT', 'Causal DiT', '每块 4 帧 · 2 步去噪', '4 frames/chunk · 2 steps',
      { dark: true, win: [[4.95, 6.4]], ring: 'var(--sand)' });
    // DiT 里的块：第 6 块之后多放一格，左移时从右侧裁剪框外滑进来
    s += '<clipPath id="' + P + 'dc"><rect x="1202" y="' + (sb + 16) + '" width="220" height="38"/></clipPath><g clip-path="url(#' + P + 'dc)">';
    for (i = 0; i < 7; i++) s += rect(1202 + i * 38, sb + 20, 30, 30, i < 5 ? '#6B757E' : i === 5 ? '#EEF0F2' : '#59636D', 0, 0, 0, ' data-k="dq' + i + '"');
    s += '</g>' + arrow([[1428, sb + 35], [1452, sb + 35]], '#9AA4AD', 2.0, null, 12);
    s += arrow([[1480, 450], [1520, 450]], OURS.fill, SW1);
    dot('d-scr', [[1480, 450], [1520, 450]], OURS.fill, [6.05, 6.3]);

    sb = card('scr', 1520, 340, 250, 220, NEUT, '画面', 'Screen', '3A 画质 · 480×864', 'high quality · 480×864', { win: [[6.25, 7.6]], ring: SUB });
    stack('ss', 1542, sb + 24, 160, 88, 7, rich);

    // 闭环：生成的新画面回到 Coding Agent
    s += arrow([[1645, 340], [1645, 100], [740, 100], [740, 215], [690, 215]], SEM.accent, SW2);
    pill('p-new', 1200, 100, '新画面', 'new frames', SEM, [[7.35, 8.0]]);
    dot('d-new', [[1645, 340], [1645, 100], [740, 100], [740, 215], [690, 215]], SEM.accent, [6.8, 8.4]);

    // 注意力上下文：记忆 3 · 参考帧 3 · 最近 20 块（末块是当前块）
    var SY = 656, Q = 16;
    s += rect(1180, 578, 590, 112, '#F4F5F7', 0, 0, 12);
    s += text(1756, 606, '注意力上下文', 20, LINE, 700, 'end', ' lang="zh"') + text(1756, 606, 'ATTENTION CONTEXT', 17, LINE, 700, 'end', ' lang="en"');
    for (i = 0; i < 3; i++) s += rect(1198 + i * 20, SY, Q, Q, MEM.accent, 0, 0, 0, ' data-k="mc' + i + '"');
    for (i = 0; i < 3; i++) s += rect(1270 + i * 20, SY, Q, Q, LOOK.accent);
    s += '<clipPath id="' + P + 'kc"><rect x="1342" y="' + (SY - 4) + '" width="396" height="' + (Q + 8) + '"/></clipPath><g clip-path="url(#' + P + 'kc)">';
    for (i = 0; i < 21; i++) s += rect(1342 + i * 20, SY, Q, Q, i < 19 ? '#C7CDD2' : i === 19 ? '#4A545E' : '#DDE1E4', 0, 0, 0, ' data-k="kw' + i + '"');
    s += '</g>';
    s += text2(1226, SY - 14, '记忆', 'Memory', 20, SUB, 400, 'middle') + text2(1298, SY - 14, '参考帧', 'Refs', 20, SUB, 400, 'middle') +
      text2(1540, SY - 14, '最近 20 块', 'Latest 20 chunks', 20, SUB, 400, 'middle', 396);
    s += arrow([[1330, 578], [1330, 550]], LINE, SW2);
    dot('d-ctx', [[1330, 578], [1330, 550]], OURS.fill, [4.55, 4.95]);

    // 空间记忆与两条回路
    sb = card('mem', 1180, 760, 400, 150, MEM, '空间记忆', 'Spatial Memory', '按位姿检索 3 帧 K/V', "3 frames' K/V by pose",
      { win: [[7.15, 9.6]] });
    var tk = 1.2, tx = 1456, ty = 800;
    var tp = [[tx, ty + 40 * tk], [tx + 18 * tk, ty + 22 * tk], [tx + 40 * tk, ty + 30 * tk], [tx + 60 * tk, ty + 10 * tk],
      [tx + 82 * tk, ty + 20 * tk], [tx + 100 * tk, ty + 4 * tk]];
    s += pline(tp, '#C9B2AC', 1.6, '4 4');
    tp.forEach(function (p, q) {
      if (q === 0 || q === 2 || q === 3) {
        s += circle(p[0], p[1], 7.5, 'none', MEM.accent, 2, ' data-k="rp' + q + '" opacity="0"') + circle(p[0], p[1], 7.5, MEM.accent);
      } else s += circle(p[0], p[1], 5, '#FFFFFF', MEM.stroke, 1.6, q === 5 ? ' data-k="np"' : '');
    });
    s += arrow([[1226, 760], [1226, SY + Q + 4]], MEM.accent, SW2);
    pill('p-kv', 1226, 728, 'K/V', 'K/V', MEM, [[8.5, 9.05]]);
    dot('d-kv', [[1226, 760], [1226, SY + Q + 4]], MEM.accent, [8.55, 8.95]);
    s += arrow([[1730, SY + Q + 4], [1730, 835], [1580, 835]], MEM.accent, SW2);
    pill('p-wr', 1655, 835, '写入', 'write', MEM, [[6.55, 7.15]]);
    dot('d-wr', [[1730, SY + Q + 4], [1730, 835], [1580, 835]], MEM.accent, [6.4, 7.2]);
    s += arrow([[470, 720], [470, 835], [1180, 835]], STATE.accent, SW2, '11 8', 16, ' data-k="pose"');
    pill('p-pose', 950, 835, '相机位姿', 'camera pose', STATE, [[7.7, 8.25]]);
    dot('d-pose', [[470, 720], [470, 835], [1180, 835]], STATE.accent, [7.0, 8.3], true);

    // 图例：两种语言的第一项字宽不同，虚线位置跟着字宽走
    [['zh', '进入网络', '只用于检索', 220], ['en', 'Into the network', 'Retrieval only', 295.2]].forEach(function (c) {
      s += '<g lang="' + c[0] + '">' + line(30, 960, 80, 960, LINE, SW2) + text(94, 967, c[1], 20, SUB, 400) +
        line(n(30 + c[3]), 960, n(80 + c[3]), 960, LINE, SW2, '11 8') + text(n(94 + c[3]), 967, c[2], 20, SUB, 400) + '</g>';
    });

    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1000" ' +
      'style="width:100%;height:auto;display:block;font-family:var(--font)">' + s + rings + dotsSvg + pills + '</svg>';
    var svg = host.firstChild;

    var el = {};
    Array.prototype.forEach.call(svg.querySelectorAll('[data-k]'), function (e) {
      var k = e.getAttribute('data-k');
      (el[k] = el[k] || []).push(e);
    });
    function set(k, attr, v) { el[k].forEach(function (e) { e.setAttribute(attr, v); }); }
    function css(k, prop, v) { el[k].forEach(function (e) { e.style[prop] = v; }); }

    var STR = ['#A398AE', '#D8D1DE'], DIM = '#E0D9E6', ACC = '#85799A';
    function push(k, t, a, off) {
      var live = t >= a && t < a + 0.7, p1 = live ? ease((t - a) / 0.45) : 0, p2 = live ? ease((t - a - 0.15) / 0.35) : 0;
      var tr = live ? 'translate(' + n(-off * p1) + ',' + n(off * p1) + ')' : '';
      ['1', '2', 't'].forEach(function (q) { set(k + q, 'transform', tr); });
      set(k + 't', 'opacity', live ? 1 - p1 : 1);
      set(k + 't2', 'opacity', p2);
      set(k + 'n', 'opacity', p1);
    }

    // 时间 time（秒，从开播起累计）对应的整幅状态
    function frame(time) {
      var t = time % T, odd = Math.floor(time / T) % 2 === 1;
      glows.forEach(function (g) { set(g.k, 'opacity', n(env(t, g.win, g.ri, g.ro) * 100) / 100); });
      dots.forEach(function (d) {
        var f = (t - d.win[0]) / (d.win[1] - d.win[0]);
        if (f < 0 || f > 1) { set(d.k, 'opacity', 0); return; }
        var p = pointAt(d.path, sine(f));
        set(d.k, 'cx', n(p[0])); set(d.k, 'cy', n(p[1]));
        set(d.k, 'opacity', n(Math.min(ease(f / 0.1), ease((1 - f) / 0.15)) * 100) / 100);
      });

      // Harness 虚线框在 Harness 阶段走 6 个虚线周期，整周期停下所以看不出跳变
      set('hbox', 'stroke-dashoffset', n(-90 * ease((t - 0.4) / 2.6)));
      // 小地图：角色每圈走一步，单数圈走回来；第一条状态量跟着变
      var m = ease((t - 1.3) / 0.9), mp = odd ? 1 - m : m;
      set('npc', 'transform', 'translate(' + n(-31.2 * mp) + ',0)');
      set('bar0', 'width', n(52 * (0.85 - 0.25 * mp)));

      // 语义条件：先整体变淡，再从左到右逐段写出（每段先亮成强调色再落回原色）
      for (var i = 0; i < 11; i++) {
        var base = STR[i % 2], w = 3.2 + 0.09 * i, c;
        if (t < 2.95 || t > w + 0.45) c = base;
        else if (t < w) c = mix(base, DIM, (t - 2.95) / 0.2);
        else if (t < w + 0.08) c = mix(DIM, ACC, (t - w) / 0.08);
        else c = mix(ACC, base, ease((t - w - 0.08) / 0.37));
        css('st' + i, 'fill', c);
      }
      push('sp', t, 3.4, 8);
      push('ss', t, 6.35, 7);

      // DiT 与注意力窗口同步左移一格；新块两步去噪
      var p = ease((t - 4.9) / 0.5), d1 = ease((t - 5.4) / 0.2), d2 = ease((t - 5.8) / 0.2);
      for (i = 0; i < 7; i++) {
        set('dq' + i, 'x', n(1202 + 38 * (i - p)));
        css('dq' + i, 'fill', i < 5 ? '#6B757E' : i === 5 ? mix('#EEF0F2', '#6B757E', p)
          : d2 > 0 ? mix('#9AA3AB', '#EEF0F2', d2) : mix('#59636D', '#9AA3AB', d1));
      }
      set('dq0', 'opacity', n(1 - p));
      for (i = 0; i < 21; i++) {
        set('kw' + i, 'x', n(1342 + 20 * (i - p)));
        css('kw' + i, 'fill', i < 19 ? '#C7CDD2' : i === 19 ? mix('#4A545E', '#C7CDD2', p)
          : d2 > 0 ? mix('#9AA3AB', '#4A545E', d2) : mix('#DDE1E4', '#9AA3AB', d1));
      }
      set('kw0', 'opacity', n(1 - p));

      // 写入后点亮轨迹上最新的位姿点；按 K/V 取回时 3 个存了帧的点泛起一圈，对应的记忆格抬起
      var lit = env(t, [[7.2, 9.95]], 0.3, 0.45);
      css('np', 'fill', mix('#FFFFFF', '#A9827A', lit));
      css('np', 'stroke', mix('#C2A19A', '#A9827A', lit));
      set('np', 'r', n(5 + 2.5 * lit));
      var rq = clamp((t - 8.35) / 0.5), ro = t >= 8.35 && t <= 8.85 ? 1 - rq : 0;
      ['rp0', 'rp2', 'rp3'].forEach(function (k) { set(k, 'r', n(7.5 + 7 * rq)); set(k, 'opacity', n(ro * 100) / 100); });
      var lift = env(t, [[8.95, 9.65]], 0.15, 0.3);
      ['mc0', 'mc1', 'mc2'].forEach(function (k) { set(k, 'transform', lift ? 'translate(0,' + n(-5 * lift) + ')' : ''); });
      // 相机位姿虚线在点经过时顺着流向走，停在整周期上
      set('pose', 'stroke-dashoffset', n(-19 * 43 * sine((t - 7.0) / 1.3)));
    }

    // 文字溢出兜底：浏览器字体比出图用的 Noto 宽时，把超出卡片的那一行压回卡片内
    function fit() {
      Array.prototype.forEach.call(svg.querySelectorAll('text[data-w]'), function (e) {
        var w = +e.getAttribute('data-w'), l = e.getComputedTextLength();
        if (l > w && !e.getAttribute('textLength')) { e.setAttribute('textLength', w); e.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
      });
    }

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var raf = 0, acc = 0, start = 0;
    function loop() { acc = (performance.now() - start) / 1000; frame(acc); raf = requestAnimationFrame(loop); }
    frame(0);
    return {
      play: function () {
        fit();
        if (raf || reduce) return;
        start = performance.now() - acc * 1000;
        raf = requestAnimationFrame(loop);
      },
      pause: function () { cancelAnimationFrame(raf); raf = 0; }
    };
  };
})();
