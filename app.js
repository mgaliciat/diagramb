(() => {
'use strict';

/* ============================== utilidades ============================== */

const $ = (sel) => document.querySelector(sel);
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const uid = () => 'id' + Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ============================== estilo ============================== */

const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const F_TITLE = `600 15px ${FONT_SANS}`;
const F_SUB = `400 13px ${FONT_SANS}`;

const PALETTES = {
  slate:   { bg: '#4d4d47', title: '#ffffff', sub: '#b9b9b1', val: '#e9e9e3' },
  ink:     { bg: '#23232b', title: '#ffffff', sub: '#9a9aa8', val: '#e4e4ea' },
  steel:   { bg: '#41566b', title: '#ffffff', sub: '#a8bdd1', val: '#dde8f2' },
  indigo:  { bg: '#473ca9', title: '#ffffff', sub: '#bdb7f0', val: '#e7e4fb' },
  blue:    { bg: '#1f5499', title: '#ffffff', sub: '#a9c6f0', val: '#dce9fb' },
  cyan:    { bg: '#0f5f6e', title: '#e8f7fa', sub: '#7fd0de', val: '#d2eef4' },
  teal:    { bg: '#0e6a52', title: '#eaf7f1', sub: '#7fd6b4', val: '#d3f0e4' },
  forest:  { bg: '#33691e', title: '#f1f8e9', sub: '#aed581', val: '#dcedc8' },
  olive:   { bg: '#6b6414', title: '#f9f5d0', sub: '#d6cd62', val: '#efe9b0' },
  amber:   { bg: '#7a4b04', title: '#ffd66b', sub: '#f2a93b', val: '#ffe7af' },
  rust:    { bg: '#8a3a22', title: '#ffd9cb', sub: '#f2a88e', val: '#ffe5da' },
  crimson: { bg: '#8e1f33', title: '#ffd7dd', sub: '#f08aa0', val: '#ffe3e8' },
  magenta: { bg: '#94236e', title: '#ffffff', sub: '#eda8d4', val: '#fbdef0' },
  plum:    { bg: '#5c3a77', title: '#ffffff', sub: '#cdb1e8', val: '#ecdffa' },
};

const EDGE_COLORS = {
  gray:   '#9b9b94',
  blue:   '#5b8def',
  green:  '#2e9e6b',
  red:    '#d65745',
  amber:  '#d99a2b',
  purple: '#8b6cc9',
};
const NODE_RADIUS = 12;

const isDark = () => store.theme === 'dark';
const canvasBg = () => (isDark() ? '#17171a' : '#f6f6f4');
const PAD_X = 18;

/* ============================== medición de texto ============================== */

const measureCtx = document.createElement('canvas').getContext('2d');

function textWidth(str, font) {
  measureCtx.font = font;
  return measureCtx.measureText(str || '').width;
}

/* ---------- markdown ligero en celdas: **negritas** y `código` ---------- */

const CODE_PAD = 4; // relleno horizontal del fondo de `código`

function parseInline(str) {
  const tokens = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(str))) {
    if (m.index > last) tokens.push({ t: str.slice(last, m.index) });
    if (m[1] != null) tokens.push({ t: m[1], bold: true });
    else tokens.push({ t: m[2], code: true });
    last = m.index + m[0].length;
  }
  if (last < str.length) tokens.push({ t: str.slice(last) });
  return tokens;
}

function measureCell(str) {
  let w = 0;
  for (const tok of parseInline(str || '')) {
    w += textWidth(tok.t, `${tok.bold ? 700 : 400} 12.5px ${FONT_MONO}`);
    if (tok.code) w += CODE_PAD * 2;
  }
  return w;
}

/* ---------- nota flotante junto a la tarjeta ---------- */

const F_NOTE = `400 11.5px ${FONT_SANS}`;
const NOTE_OVERLAP = 10;   // cuánto se encima la nota sobre la tarjeta
const NOTE_LIFT = 10;      // cuánto asoma la nota por encima de la tarjeta
const NOTE_TILT = 2.5;     // inclinación en grados, como post-it pegado
const NOTE_TEXT_W = 150;   // ancho máximo del texto antes de envolver

function wrapText(str, font, maxW) {
  const lines = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const probe = line ? line + ' ' + word : word;
      if (textWidth(probe, font) <= maxW || !line) line = probe;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

function noteLayout(n) {
  if (!n.note || !n.note.trim()) return null;
  const lines = wrapText(n.note, F_NOTE, NOTE_TEXT_W);
  const wMax = Math.max(30, ...lines.map((l) => textWidth(l, F_NOTE)));
  return { w: Math.ceil(wMax) + 20, h: lines.length * 15 + 14, lines };
}

// Calcula tamaño y disposición interna de un nodo a partir de su contenido.
function nodeSize(n) {
  const rows = (n.rows || []).filter((r) => r[0] || r[1]);
  const titleW = textWidth(n.title, F_TITLE);
  const subW = textWidth(n.subtitle, F_SUB);

  const note = noteLayout(n);

  if (!rows.length) {
    const w = clamp(Math.max(titleW, subW) + PAD_X * 2 + 8, 170, 620);
    const h = n.subtitle ? 72 : 54;
    return { w, h, rows, keyColW: 0, note };
  }

  let keyColW = 0;
  let valColW = 0;
  for (const [k, v] of rows) {
    keyColW = Math.max(keyColW, measureCell(k));
    valColW = Math.max(valColW, measureCell(v));
  }
  const colGap = 48;
  const w = clamp(
    Math.max(titleW, subW, keyColW + colGap + valColW) + PAD_X * 2,
    280, 860
  );
  let h = 16 + 20;                 // padding superior + título
  if (n.subtitle) h += 19;
  h += 12 + rows.length * 22 + 14; // separación + filas + padding inferior
  return { w, h, rows, keyColW, note };
}

/* ============================== estado ============================== */

const STORAGE_KEY = 'diagramb.v1';

let store = null;       // { current, docs: { id: doc } }
let sizes = {};         // tamaños de nodos calculados en cada render
let selection = null;   // { type: 'node', ids: [...] } | { type: 'edge', id }
let guides = { x: null, y: null };
let history = [];
let hIndex = -1;
let saveTimer = null;
let historyTimer = null;

const doc = () => store.docs[store.current];
const view = () => doc().view;
const getNode = (id) => doc().nodes.find((n) => n.id === id);
const getEdge = (id) => doc().edges.find((e) => e.id === id);
const isTimeline = () => doc().type === 'timeline';

function newDoc(name, type) {
  return {
    id: uid(),
    name,
    type: type || 'flow',
    nodes: [],
    edges: [],
    view: { x: 0, y: 0, z: 1 },
  };
}

function seedDoc() {
  const d = newDoc('Mi primer diagrama');
  const mk = (x, y, title, subtitle, color, rows) => {
    const n = { id: uid(), x, y, title, subtitle, color, rows: rows || [] };
    d.nodes.push(n);
    return n.id;
  };
  const a = mk(430, 60, 'rest-ops-partner-assign', 'origen de la petición', 'slate');
  const b = mk(250, 200, 'Endpoints interceptados · iteración 1',
    'PUT · /api/ms/order-modification/{endpoint}/{orderId}', 'indigo', [
      ['**endpoint**', '**acción interna**'],
      ['`hold_partner_assign`', 'NOTIFY_ORDER_HOLD'],
      ['`assign_to_partner_v2`', 'ASSIGN_TO_PARTNER'],
    ]);
  const c = mk(440, 450, 'assign-gateway', 'obtiene store_id', 'indigo');
  const e = mk(437, 580, '¿Tienda migrada?', 'consulta en Statsig', 'amber');
  d.nodes[d.nodes.length - 1].note = 'El gate vive en Statsig; si cambia el nombre hay que avisar a ops.';
  const f = mk(160, 740, 'order-modification', 'ejecuta el request real', 'teal');
  const g = mk(720, 740, 'No reenvía', 'assign-partners lo maneja', 'slate');
  const h = mk(415, 900, 'Audit assign-partners', 'siempre: migrada o no', 'rust');
  const link = (from, to, label) => d.edges.push({ id: uid(), from, to, label: label || '' });
  link(a, b, 'modo dry');
  link(b, c);
  link(c, e);
  link(e, f, 'no migrada');
  link(e, g, 'migrada');
  link(f, h);
  link(g, h);
  return d;
}

// Timeline nuevo con hitos de ejemplo: el orden del arreglo es la secuencia.
function seedTimeline(name) {
  const d = newDoc(name, 'timeline');
  const mk = (title, subtitle, color) =>
    d.nodes.push({ id: uid(), x: 0, y: 0, title, subtitle, color, rows: [] });
  mk('Antes', 'cómo era', 'slate');
  mk('El cambio', 'qué pasó', 'indigo');
  mk('Después', 'cómo quedó', 'teal');
  return d;
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.docs && parsed.current && parsed.docs[parsed.current]) {
        store = parsed;
      }
    }
  } catch (_) { /* almacenamiento corrupto: se regenera */ }
  if (!store) {
    const d = seedDoc();
    store = { current: d.id, docs: { [d.id]: d } };
  }
  if (!store.theme) store.theme = 'light';
  if (!store.edgeDefaults) {
    store.edgeDefaults = { dashed: false, both: false, thick: false, color: 'gray' };
  }
  saveStore();
}

function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, 150);
}

/* ============================== historial (deshacer) ============================== */

function resetHistory() {
  history = [JSON.stringify({ nodes: doc().nodes, edges: doc().edges })];
  hIndex = 0;
}

function commit() {
  const snap = JSON.stringify({ nodes: doc().nodes, edges: doc().edges });
  if (snap === history[hIndex]) { saveStore(); return; }
  history = history.slice(0, hIndex + 1);
  history.push(snap);
  if (history.length > 120) history.shift();
  hIndex = history.length - 1;
  saveStore();
}

// Para escritura en inputs: agrupa pulsaciones en un solo paso de deshacer.
function commitDebounced() {
  saveStore();
  clearTimeout(historyTimer);
  historyTimer = setTimeout(commit, 450);
}

function restoreSnapshot(snap) {
  const data = JSON.parse(snap);
  doc().nodes = data.nodes;
  doc().edges = data.edges;
  if (selection) {
    if (selection.type === 'node') {
      selection.ids = selection.ids.filter((id) => doc().nodes.some((n) => n.id === id));
      if (!selection.ids.length) selection = null;
    } else if (!doc().edges.some((e) => e.id === selection.id)) {
      selection = null;
    }
  }
  saveStore();
  renderAll();
}

function undo() {
  if (hIndex > 0) restoreSnapshot(history[--hIndex]);
}

function redo() {
  if (hIndex < history.length - 1) restoreSnapshot(history[++hIndex]);
}

/* ============================== geometría de flechas ============================== */

const SIDE_NORMALS = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

function anchorPoint(n, side) {
  const s = sizes[n.id] || nodeSize(n);
  switch (side) {
    case 'top': return [n.x + s.w / 2, n.y];
    case 'bottom': return [n.x + s.w / 2, n.y + s.h];
    case 'left': return [n.x, n.y + s.h / 2];
    case 'right': return [n.x + s.w, n.y + s.h / 2];
  }
}

// Elige automáticamente los lados de salida y llegada según la posición relativa.
function chooseSides(a, b) {
  const sa = sizes[a.id] || nodeSize(a);
  const sb = sizes[b.id] || nodeSize(b);
  const dx = (b.x + sb.w / 2) - (a.x + sa.w / 2);
  const dy = (b.y + sb.h / 2) - (a.y + sa.h / 2);
  // sesgo vertical: los flujos suelen leerse de arriba hacia abajo
  if (Math.abs(dy) * 2 >= Math.abs(dx)) {
    return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
}

// Desplaza un anclaje a lo largo de su lado (para repartir flechas que comparten lado).
function shiftAlongSide(p, side, off) {
  return side === 'top' || side === 'bottom' ? [p[0] + off, p[1]] : [p[0], p[1] + off];
}

let edgeGeos = {};

// Calcula la geometría de todas las flechas, repartiendo los anclajes cuando
// varias flechas entran o salen por el mismo lado de un nodo.
function computeEdgeGeos() {
  edgeGeos = {};
  const ends = [];
  for (const e of doc().edges) {
    const a = getNode(e.from);
    const b = getNode(e.to);
    if (!a || !b) continue;
    const [sideA, sideB] = chooseSides(a, b);
    ends.push({ e, a, b, sideA, sideB, offA: 0, offB: 0 });
  }
  const groups = {};
  for (const it of ends) {
    (groups[it.a.id + '|' + it.sideA] = groups[it.a.id + '|' + it.sideA] || []).push({ it, end: 'a' });
    (groups[it.b.id + '|' + it.sideB] = groups[it.b.id + '|' + it.sideB] || []).push({ it, end: 'b' });
  }
  for (const [key, items] of Object.entries(groups)) {
    if (items.length < 2) continue;
    const [nodeId, side] = key.split('|');
    const horiz = side === 'top' || side === 'bottom';
    // ordena por la posición del nodo opuesto para que las flechas no se crucen
    items.sort((p, q) => {
      const po = p.end === 'a' ? p.it.b : p.it.a;
      const qo = q.end === 'a' ? q.it.b : q.it.a;
      const ps = sizes[po.id], qs = sizes[qo.id];
      return horiz
        ? (po.x + ps.w / 2) - (qo.x + qs.w / 2)
        : (po.y + ps.h / 2) - (qo.y + qs.h / 2);
    });
    const s = sizes[nodeId];
    const span = Math.min((horiz ? s.w : s.h) * 0.6, items.length * 44);
    items.forEach((p, i) => {
      const off = ((i + 0.5) / items.length - 0.5) * span;
      if (p.end === 'a') p.it.offA = off; else p.it.offB = off;
    });
  }
  for (const it of ends) edgeGeos[it.e.id] = edgeGeometryFor(it);
}

function edgeGeometryFor({ e, a, b, sideA, sideB, offA, offB }) {
  let p1 = shiftAlongSide(anchorPoint(a, sideA), sideA, offA);
  let p2 = shiftAlongSide(anchorPoint(b, sideB), sideB, offB);
  const nB = SIDE_NORMALS[sideB];
  p2 = [p2[0] + nB[0] * 5, p2[1] + nB[1] * 5]; // pequeño espacio para la punta
  const nA = SIDE_NORMALS[sideA];
  if (e && e.both) p1 = [p1[0] + nA[0] * 5, p1[1] + nA[1] * 5];
  const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const k = clamp(dist * 0.38, 36, 150);
  const c1 = [p1[0] + nA[0] * k, p1[1] + nA[1] * k];
  const c2 = [p2[0] + nB[0] * k, p2[1] + nB[1] * k];
  const mid = [
    (p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8,
    (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8,
  ];
  return {
    d: `M ${p1[0]} ${p1[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`,
    mid,
  };
}

/* ============================== línea de tiempo ============================== */

const TL_STEM = 56;      // distancia entre la tarjeta y el eje
const TL_DOT_GAP = 110;  // separación mínima entre puntos sobre el eje
const TL_CARD_GAP = 36;  // separación mínima entre tarjetas del mismo lado

let tlInfo = null;    // { cx, sides, x0, x1 } del último layout
let tlDragId = null;  // hito en arrastre: el layout no le toca la posición

// Coloca los hitos sobre el eje horizontal (y = 0) en el orden del arreglo,
// alternando arriba/abajo salvo que el hito tenga un lado forzado.
function layoutTimeline() {
  tlInfo = null;
  const ns = doc().nodes;
  if (!ns.length) return;
  const cx = {};
  const sides = {};
  const busyRight = { up: -Infinity, down: -Infinity }; // borde derecho ocupado por lado
  let prev = null;
  ns.forEach((n, i) => {
    const s = sizes[n.id];
    const side = n.side === 'up' || n.side === 'down' ? n.side : (i % 2 ? 'down' : 'up');
    const effW = s.w + (s.note ? s.note.w - NOTE_OVERLAP + 8 : 0);
    let c = prev === null ? 0 : prev + TL_DOT_GAP;
    c = Math.max(c, busyRight[side] + TL_CARD_GAP + s.w / 2);
    cx[n.id] = c;
    sides[n.id] = side;
    busyRight[side] = c - s.w / 2 + effW;
    prev = c;
    if (n.id !== tlDragId) {
      n.x = Math.round(c - s.w / 2);
      n.y = side === 'up' ? -TL_STEM - s.h : TL_STEM;
    }
  });
  tlInfo = {
    cx, sides,
    x0: cx[ns[0].id] - 46,
    x1: cx[ns[ns.length - 1].id] + 72,
  };
}

// Dibuja el eje con su flecha, el conector de cada hito y su punto de color.
function renderTimelineAxis(parent, opts = {}) {
  if (!tlInfo) return;
  const g = el('g', {}, parent);
  const axis = EDGE_COLORS.gray;
  const bg = opts.bg || canvasBg();
  el('line', {
    x1: tlInfo.x0, y1: 0, x2: tlInfo.x1, y2: 0,
    stroke: axis, 'stroke-width': 2, 'stroke-linecap': 'round',
    'marker-end': 'url(#arrow-gray)',
  }, g);
  for (const n of doc().nodes) {
    const s = sizes[n.id];
    const c = tlInfo.cx[n.id];
    const up = tlInfo.sides[n.id] === 'up';
    el('line', {
      x1: n.x + s.w / 2, y1: up ? n.y + s.h : n.y, x2: c, y2: 0,
      stroke: axis, 'stroke-width': 1.4,
    }, g);
    const pal = PALETTES[n.color] || PALETTES.slate;
    el('circle', {
      cx: c, cy: 0, r: 6, fill: pal.bg, stroke: bg, 'stroke-width': 2.5,
    }, g);
  }
}

/* ============================== render ============================== */

const canvas = $('#canvas');
const worldG = $('#world');
const edgesG = $('#edgesG');
const nodesG = $('#nodesG');
const guidesG = $('#guidesG');
const draftG = $('#draftG');
const dotsPattern = $('#dots');

// Crea un marcador de punta de flecha por cada color (sirve para ambos extremos).
function ensureEdgeMarkers(defsEl) {
  for (const [key, color] of Object.entries(EDGE_COLORS)) {
    const m = el('marker', {
      id: `arrow-${key}`, viewBox: '0 0 10 10', refX: 8.5, refY: 5,
      markerWidth: 7.5, markerHeight: 7.5, orient: 'auto-start-reverse',
    }, defsEl);
    el('path', { d: 'M0 0 L10 5 L0 10 z', fill: color }, m);
  }
}

function applyViewTransform() {
  const v = view();
  const t = `translate(${v.x} ${v.y}) scale(${v.z})`;
  worldG.setAttribute('transform', t);
  dotsPattern.setAttribute('patternTransform', t);
  $('#zoomReset').textContent = Math.round(v.z * 100) + '%';
}

function addText(parent, str, x, y, opts) {
  const t = el('text', {
    x, y,
    fill: opts.fill,
    'font-family': opts.mono ? FONT_MONO : FONT_SANS,
    'font-size': opts.size,
    'font-weight': opts.weight || 400,
    'text-anchor': opts.anchor || 'start',
  }, parent);
  t.textContent = str;
  return t;
}

// Texto de celda con markdown ligero: **negritas** y `código` (con fondo).
// Las posiciones de cada segmento se calculan a mano para que coincidan
// con el ancho medido y soporten alineación a la derecha.
function addCellText(parent, str, x, y, opts) {
  const tokens = parseInline(str || '');
  const rich = tokens.some((tok) => tok.bold || tok.code);
  if (!rich) {
    return addText(parent, str, x, y, {
      fill: opts.fill, size: 12.5, mono: true, anchor: opts.anchor,
    });
  }
  const advances = tokens.map((tok) =>
    textWidth(tok.t, `${tok.bold ? 700 : 400} 12.5px ${FONT_MONO}`) +
    (tok.code ? CODE_PAD * 2 : 0));
  const total = advances.reduce((a, b) => a + b, 0);
  let cursor = opts.anchor === 'end' ? x - total
    : opts.anchor === 'middle' ? x - total / 2 : x;
  const starts = tokens.map((_, i) => {
    const s = cursor;
    cursor += advances[i];
    return s;
  });
  tokens.forEach((tok, i) => {
    if (!tok.code) return;
    el('rect', {
      x: starts[i], y: y - 11.5, width: advances[i], height: 15.5, rx: 4,
      fill: 'rgba(255, 255, 255, 0.13)',
    }, parent);
  });
  const t = el('text', {
    y, fill: opts.fill, 'font-family': FONT_MONO,
    'font-size': 12.5, 'text-anchor': 'start',
  }, parent);
  tokens.forEach((tok, i) => {
    const span = el('tspan', { x: starts[i] + (tok.code ? CODE_PAD : 0), y }, t);
    if (tok.bold) span.setAttribute('font-weight', 700);
    span.textContent = tok.t;
  });
  return t;
}

function renderNode(n, opts = {}) {
  const s = sizes[n.id];
  const pal = PALETTES[n.color] || PALETTES.slate;
  const isSel = !opts.forExport && selection &&
    selection.type === 'node' && selection.ids.includes(n.id);
  const g = el('g', { transform: `translate(${n.x} ${n.y})` });
  if (!opts.forExport) {
    g.classList.add('node');
    g.dataset.id = n.id;
    if (isSel) g.classList.add('selected');
  }

  const rectAttrs = { width: s.w, height: s.h, rx: NODE_RADIUS, fill: pal.bg };
  if (isDark()) {
    // en fondo oscuro, los nodos más oscuros necesitan un borde para distinguirse
    rectAttrs.stroke = 'rgba(255, 255, 255, 0.14)';
    rectAttrs['stroke-width'] = 1;
  }
  el('rect', rectAttrs, g);

  const editable = []; // [elemento, campo, fila, columna]
  if (!s.rows.length) {
    const cx = s.w / 2;
    const titleY = n.subtitle ? 30 : s.h / 2 + 5;
    editable.push([addText(g, n.title, cx, titleY,
      { fill: pal.title, size: 15, weight: 600, anchor: 'middle' }), 'title']);
    if (n.subtitle) {
      editable.push([addText(g, n.subtitle, cx, titleY + 21,
        { fill: pal.sub, size: 13, anchor: 'middle' }), 'subtitle']);
    }
  } else {
    let y = 16 + 15;
    editable.push([addText(g, n.title, PAD_X, y,
      { fill: pal.title, size: 15, weight: 600 }), 'title']);
    if (n.subtitle) {
      y += 19;
      editable.push([addText(g, n.subtitle, PAD_X, y, { fill: pal.sub, size: 13 }), 'subtitle']);
    }
    y += 12;
    const valX = s.w - PAD_X;
    for (const row of s.rows) {
      y += 22;
      const ri = n.rows.indexOf(row);
      editable.push([addCellText(g, row[0], PAD_X, y, { fill: pal.sub }), 'row', ri, 0]);
      editable.push([addCellText(g, row[1], valX, y,
        { fill: pal.val, anchor: 'end' }), 'row', ri, 1]);
    }
  }

  if (s.note) {
    // nota adhesiva pegada e inclinada sobre la esquina de la tarjeta:
    // solo decorativa, sin puertos ni anclaje de flechas
    const ng = el('g', {
      transform: `translate(${s.w - NOTE_OVERLAP} ${-NOTE_LIFT}) rotate(${NOTE_TILT})`,
    }, g);
    el('rect', {
      x: 3, y: 3, width: s.note.w, height: s.note.h, rx: 6,
      fill: 'rgba(0, 0, 0, 0.10)',
    }, ng);
    el('rect', {
      width: s.note.w, height: s.note.h, rx: 6,
      fill: '#fbedb0', stroke: 'rgba(0, 0, 0, 0.12)', 'stroke-width': 1,
    }, ng);
    s.note.lines.forEach((line, i) => {
      addText(ng, line, 10, 16 + i * 15, { fill: '#6b5a14', size: 11.5 });
    });
    if (!opts.forExport) ng.dataset.noteNode = n.id;
  }

  if (!opts.forExport) {
    for (const [tEl, field, ri, ci] of editable) {
      tEl.classList.add('editable');
      tEl.dataset.editNode = n.id;
      tEl.dataset.editField = field;
      if (field === 'row') {
        tEl.dataset.editRow = ri;
        tEl.dataset.editCol = ci;
      }
    }
    if (isSel) {
      el('rect', {
        x: -4, y: -4, width: s.w + 8, height: s.h + 8, rx: NODE_RADIUS + 4,
        fill: 'none', stroke: '#3d8bfd', 'stroke-width': 1.6,
      }, g);
    }
    // en timelines no hay flechas entre hitos: sin puertos de conexión
    if (!isTimeline()) for (const side of ['top', 'bottom', 'left', 'right']) {
      const [px, py] = anchorPoint({ ...n, x: 0, y: 0 }, side);
      const port = el('circle', {
        cx: px, cy: py, r: 5.5,
        fill: '#ffffff', stroke: '#3d8bfd', 'stroke-width': 1.6,
      }, g);
      port.classList.add('port');
      port.dataset.side = side;
      port.dataset.node = n.id;
    }
  }
  return g;
}

function renderEdge(edge, opts = {}) {
  const geo = edgeGeos[edge.id];
  if (!geo) return null;
  const g = el('g', {});
  const isSel = !opts.forExport && selection &&
    selection.type === 'edge' && selection.id === edge.id;
  const colorKey = EDGE_COLORS[edge.color] ? edge.color : 'gray';
  const marker = isSel ? 'url(#arrowSel)' : `url(#arrow-${colorKey})`;
  const attrs = {
    d: geo.d,
    fill: 'none',
    stroke: isSel ? '#3d8bfd' : EDGE_COLORS[colorKey],
    'stroke-width': edge.thick ? 2.6 : 1.6,
    'marker-end': marker,
  };
  if (edge.dashed) attrs['stroke-dasharray'] = '7 5';
  if (edge.both) attrs['marker-start'] = marker;
  el('path', attrs, g);
  if (edge.label) {
    const labelFill = isSel ? '#3d8bfd'
      : colorKey === 'gray' ? '#8a8a83' : EDGE_COLORS[colorKey];
    const t = addText(g, edge.label, geo.mid[0], geo.mid[1] - 7, {
      fill: labelFill, size: 12.5, anchor: 'middle',
    });
    t.setAttribute('style',
      `paint-order: stroke; stroke: ${opts.bg || canvasBg()}; stroke-width: 5px;`);
    if (!opts.forExport) {
      t.classList.add('editable');
      t.dataset.editEdge = edge.id;
    }
  }
  if (!opts.forExport) {
    const hit = el('path', {
      d: geo.d, fill: 'none', stroke: 'transparent', 'stroke-width': 14,
    }, g);
    hit.classList.add('edge-hit');
    hit.dataset.id = edge.id;
  }
  return g;
}

function computeSizes() {
  sizes = {};
  for (const n of doc().nodes) sizes[n.id] = nodeSize(n);
  if (isTimeline()) layoutTimeline();
  computeEdgeGeos();
}

function renderGuides() {
  guidesG.innerHTML = '';
  const v = view();
  const rect = canvas.getBoundingClientRect();
  const x0 = -v.x / v.z, y0 = -v.y / v.z;
  const x1 = (rect.width - v.x) / v.z, y1 = (rect.height - v.y) / v.z;
  const attrs = { stroke: '#f43f8e', 'stroke-width': 1 / v.z, 'stroke-dasharray': `${4 / v.z} ${4 / v.z}` };
  if (guides.x != null) el('line', { x1: guides.x, y1: y0, x2: guides.x, y2: y1, ...attrs }, guidesG);
  if (guides.y != null) el('line', { x1: x0, y1: guides.y, x2: x1, y2: guides.y, ...attrs }, guidesG);
}

function renderAll() {
  computeSizes();
  edgesG.innerHTML = '';
  for (const e of doc().edges) {
    const g = renderEdge(e);
    if (g) edgesG.appendChild(g);
  }
  if (isTimeline()) renderTimelineAxis(edgesG);
  nodesG.innerHTML = '';
  for (const n of doc().nodes) nodesG.appendChild(renderNode(n));
  renderGuides();
  applyViewTransform();
  syncPanel();
  syncDocBar();
  if (!edgePopupEl.hidden) {
    const e = popupEdge();
    if (e) syncEdgeControlsAll(e); else hideEdgePopup();
  }
}

/* ============================== panel lateral ============================== */

const panel = $('#panel');
const panelNode = $('#panelNode');
const panelEdge = $('#panelEdge');
const panelMulti = $('#panelMulti');
let panelFor = null; // evita reconstruir las filas mientras se escribe en ellas

function buildSwatches(containerSel) {
  const wrap = $(containerSel);
  wrap.innerHTML = '';
  for (const [key, pal] of Object.entries(PALETTES)) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.background = pal.bg;
    b.title = key;
    b.dataset.color = key;
    b.addEventListener('click', () => {
      const ns = selectedNodes();
      if (!ns.length) return;
      for (const n of ns) n.color = key;
      commit();
      renderAll();
    });
    wrap.appendChild(b);
  }
}

/* ---------- lado del hito en el timeline ---------- */

const SIDE_DEFS = [
  { k: 'auto', t: 'Auto' },
  { k: 'up', t: 'Arriba' },
  { k: 'down', t: 'Abajo' },
];

function buildSideControl(containerSel) {
  const wrap = $(containerSel);
  for (const d of SIDE_DEFS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = d.t;
    b.dataset.k = d.k;
    b.addEventListener('click', () => {
      const ns = selectedNodes();
      if (!ns.length) return;
      for (const n of ns) {
        if (d.k === 'auto') delete n.side;
        else n.side = d.k;
      }
      commit();
      renderAll();
    });
    wrap.appendChild(b);
  }
}

/* ---------- alinear y distribuir la selección múltiple ---------- */

function alignSelection(kind) {
  const ns = selectedNodes();
  if (ns.length < 2) return;
  computeSizes();
  const left = Math.min(...ns.map((n) => n.x));
  const right = Math.max(...ns.map((n) => n.x + sizes[n.id].w));
  const top = Math.min(...ns.map((n) => n.y));
  const bottom = Math.max(...ns.map((n) => n.y + sizes[n.id].h));
  for (const n of ns) {
    const s = sizes[n.id];
    if (kind === 'left') n.x = left;
    if (kind === 'centerH') n.x = Math.round((left + right) / 2 - s.w / 2);
    if (kind === 'right') n.x = right - s.w;
    if (kind === 'top') n.y = top;
    if (kind === 'middleV') n.y = Math.round((top + bottom) / 2 - s.h / 2);
    if (kind === 'bottom') n.y = bottom - s.h;
  }
  commit();
  renderAll();
}

function distributeSelection(axis) {
  const ns = selectedNodes();
  if (ns.length < 3) return;
  computeSizes();
  const horiz = axis === 'h';
  const arr = [...ns].sort((a, b) => (horiz ? a.x - b.x : a.y - b.y));
  const size = (n) => (horiz ? sizes[n.id].w : sizes[n.id].h);
  const first = arr[0];
  const last = arr[arr.length - 1];
  const start = horiz ? first.x : first.y;
  const end = (horiz ? last.x : last.y) + size(last);
  const gap = (end - start - arr.reduce((a, n) => a + size(n), 0)) / (arr.length - 1);
  let cur = start;
  for (const n of arr) {
    if (horiz) n.x = Math.round(cur); else n.y = Math.round(cur);
    cur += size(n) + gap;
  }
  commit();
  renderAll();
}

const iconBar = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" fill="currentColor"/>`;
const iconLine = (x1, y1, x2, y2) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`;
const svgIcon = (inner) => `<svg viewBox="0 0 16 16" width="14" height="14">${inner}</svg>`;

const ALIGN_DEFS = [
  { k: 'left', title: 'Alinear a la izquierda',
    icon: iconLine(2, 1.5, 2, 14.5) + iconBar(4, 3, 9, 3.5) + iconBar(4, 9.5, 6, 3.5) },
  { k: 'centerH', title: 'Centrar horizontalmente',
    icon: iconLine(8, 1.5, 8, 14.5) + iconBar(3, 3, 10, 3.5) + iconBar(5, 9.5, 6, 3.5) },
  { k: 'right', title: 'Alinear a la derecha',
    icon: iconLine(14, 1.5, 14, 14.5) + iconBar(3, 3, 9, 3.5) + iconBar(6, 9.5, 6, 3.5) },
  { k: 'top', title: 'Alinear arriba',
    icon: iconLine(1.5, 2, 14.5, 2) + iconBar(3, 4, 3.5, 9) + iconBar(9.5, 4, 3.5, 6) },
  { k: 'middleV', title: 'Centrar verticalmente',
    icon: iconLine(1.5, 8, 14.5, 8) + iconBar(3, 3, 3.5, 10) + iconBar(9.5, 5, 3.5, 6) },
  { k: 'bottom', title: 'Alinear abajo',
    icon: iconLine(1.5, 14, 14.5, 14) + iconBar(3, 3, 3.5, 9) + iconBar(9.5, 6, 3.5, 6) },
];

const DIST_DEFS = [
  { k: 'h', title: 'Distribuir horizontalmente',
    icon: iconBar(2, 3, 2.5, 10) + iconBar(6.75, 3, 2.5, 10) + iconBar(11.5, 3, 2.5, 10) },
  { k: 'v', title: 'Distribuir verticalmente',
    icon: iconBar(3, 2, 10, 2.5) + iconBar(3, 6.75, 10, 2.5) + iconBar(3, 11.5, 10, 2.5) },
];

function buildAlignControls() {
  const alignWrap = $('#pAlign');
  for (const group of [ALIGN_DEFS.slice(0, 3), ALIGN_DEFS.slice(3)]) {
    const seg = document.createElement('div');
    seg.className = 'seg';
    for (const d of group) {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = d.title;
      b.dataset.k = d.k;
      b.innerHTML = svgIcon(d.icon);
      b.addEventListener('click', () => alignSelection(d.k));
      seg.appendChild(b);
    }
    alignWrap.appendChild(seg);
  }
  const distWrap = $('#pDistribute');
  for (const d of DIST_DEFS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = d.title;
    b.dataset.k = d.k;
    b.innerHTML = svgIcon(d.icon);
    b.addEventListener('click', () => distributeSelection(d.k));
    distWrap.appendChild(b);
  }
}

/* ---------- controles de estilo de flecha (panel y popup) ---------- */

const edgeControlSets = [];

function buildEdgeControls(containerSel, getEdge) {
  const wrap = $(containerSel);
  wrap.classList.add('edge-controls');
  const apply = (fn) => {
    const e = getEdge();
    if (!e) return;
    fn(e);
    store.edgeDefaults = {
      dashed: !!e.dashed, both: !!e.both, thick: !!e.thick, color: e.color || 'gray',
    };
    commit();
    renderCanvasOnly();
    syncEdgeControlsAll(e);
  };
  const seg = (defs) => {
    const div = document.createElement('div');
    div.className = 'seg';
    for (const d of defs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = d.t;
      b.addEventListener('click', () => apply(d.fn));
      d.btn = b;
      div.appendChild(b);
    }
    wrap.appendChild(div);
    return defs;
  };
  const dir = seg([
    { t: '→ simple', fn: (e) => { e.both = false; } },
    { t: '↔ doble', fn: (e) => { e.both = true; } },
  ]);
  const sty = seg([
    { t: '———', fn: (e) => { e.dashed = false; } },
    { t: '– – –', fn: (e) => { e.dashed = true; } },
  ]);
  const wid = seg([
    { t: 'fina', fn: (e) => { e.thick = false; } },
    { t: 'gruesa', fn: (e) => { e.thick = true; } },
  ]);
  const dotsDiv = document.createElement('div');
  dotsDiv.className = 'dots';
  const dots = [];
  for (const [key, color] of Object.entries(EDGE_COLORS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dot';
    b.style.background = color;
    b.title = key;
    b.addEventListener('click', () => apply((e) => { e.color = key; }));
    dots.push({ key, btn: b });
    dotsDiv.appendChild(b);
  }
  wrap.appendChild(dotsDiv);
  edgeControlSets.push({ dir, sty, wid, dots });
}

function syncEdgeControlsAll(e) {
  if (!e) return;
  for (const s of edgeControlSets) {
    s.dir[0].btn.classList.toggle('active', !e.both);
    s.dir[1].btn.classList.toggle('active', !!e.both);
    s.sty[0].btn.classList.toggle('active', !e.dashed);
    s.sty[1].btn.classList.toggle('active', !!e.dashed);
    s.wid[0].btn.classList.toggle('active', !e.thick);
    s.wid[1].btn.classList.toggle('active', !!e.thick);
    for (const d of s.dots) {
      d.btn.classList.toggle('active', d.key === (e.color || 'gray'));
    }
  }
}

/* ---------- popup al crear una flecha ---------- */

const edgePopupEl = $('#edgePopup');
let popupEdgeId = null;

const popupEdge = () => (popupEdgeId ? getEdge(popupEdgeId) : null);

function showEdgePopup(edgeId, x, y) {
  popupEdgeId = edgeId;
  edgePopupEl.hidden = false;
  edgePopupEl.style.left = clamp(x + 8, 8, window.innerWidth - 250) + 'px';
  edgePopupEl.style.top = clamp(y + 8, 58, window.innerHeight - 230) + 'px';
  syncEdgeControlsAll(popupEdge());
}

function hideEdgePopup() {
  popupEdgeId = null;
  edgePopupEl.hidden = true;
}

$('#popupDone').addEventListener('click', hideEdgePopup);

document.addEventListener('pointerdown', (ev) => {
  if (edgePopupEl.hidden || edgePopupEl.contains(ev.target)) return;
  hideEdgePopup();
}, true);

const selectedNodes = () =>
  selection && selection.type === 'node'
    ? selection.ids.map(getNode).filter(Boolean) : [];
const selectedNode = () => {
  const ns = selectedNodes();
  return ns.length === 1 ? ns[0] : null;
};
const selectedEdge = () =>
  selection && selection.type === 'edge'
    ? doc().edges.find((e) => e.id === selection.id) : null;

function buildRowsEditor(n) {
  const wrap = $('#pRows');
  wrap.innerHTML = '';
  (n.rows || []).forEach((row, i) => {
    const div = document.createElement('div');
    div.className = 'row-edit';
    const inK = document.createElement('input');
    inK.type = 'text';
    inK.placeholder = 'clave';
    inK.value = row[0];
    const inV = document.createElement('input');
    inV.type = 'text';
    inV.placeholder = 'valor';
    inV.value = row[1];
    const del = document.createElement('button');
    del.className = 'row-del';
    del.textContent = '×';
    del.title = 'Quitar fila';
    inK.addEventListener('input', () => { row[0] = inK.value; commitDebounced(); renderCanvasOnly(); });
    inV.addEventListener('input', () => { row[1] = inV.value; commitDebounced(); renderCanvasOnly(); });
    del.addEventListener('click', () => {
      n.rows.splice(i, 1);
      commit();
      panelFor = null;
      renderAll();
    });
    div.append(inK, inV, del);
    wrap.appendChild(div);
  });
}

// Re-renderiza solo el lienzo (sin tocar el panel) para no perder el foco al escribir.
function renderCanvasOnly() {
  computeSizes();
  edgesG.innerHTML = '';
  for (const e of doc().edges) {
    const g = renderEdge(e);
    if (g) edgesG.appendChild(g);
  }
  if (isTimeline()) renderTimelineAxis(edgesG);
  nodesG.innerHTML = '';
  for (const n of doc().nodes) nodesG.appendChild(renderNode(n));
}

function syncPanel() {
  const ns = selectedNodes();
  const n = ns.length === 1 ? ns[0] : null;
  const multi = ns.length > 1;
  const e = selectedEdge();
  panel.hidden = !n && !e && !multi;
  panelNode.hidden = !n;
  panelEdge.hidden = !e;
  panelMulti.hidden = !multi;
  const key = selection
    ? selection.type + ':' + (selection.type === 'node' ? selection.ids.join(',') : selection.id)
    : null;
  if (n) {
    if (panelFor !== key) {
      $('#pTitle').value = n.title || '';
      $('#pSub').value = n.subtitle || '';
      $('#pNote').value = n.note || '';
      buildRowsEditor(n);
    }
  } else if (e) {
    if (panelFor !== key) $('#pLabel').value = e.label || '';
    syncEdgeControlsAll(e);
  } else if (multi) {
    $('#pMultiCount').textContent = ns.length + ' nodos seleccionados';
    // en timelines la posición la decide el layout: alinear/distribuir no aplican
    $('#pAlignField').hidden = isTimeline();
    $('#pDistField').hidden = isTimeline();
    for (const b of document.querySelectorAll('#pDistribute button')) {
      b.disabled = ns.length < 3;
    }
  }
  $('#pSideField').hidden = !isTimeline();
  $('#pSideFieldMulti').hidden = !isTimeline();
  const sideUniform = isTimeline() && ns.length &&
    ns.every((m) => (m.side || 'auto') === (ns[0].side || 'auto'))
    ? (ns[0].side || 'auto') : null;
  for (const b of document.querySelectorAll('#pSide button, #pSideMulti button')) {
    b.classList.toggle('active', b.dataset.k === sideUniform);
  }
  const uniform = ns.length &&
    ns.every((m) => (m.color || 'slate') === (ns[0].color || 'slate'))
    ? (ns[0].color || 'slate') : null;
  for (const b of document.querySelectorAll('.swatch')) {
    b.classList.toggle('active', b.dataset.color === uniform);
  }
  panelFor = key;
}

$('#pTitle').addEventListener('input', (ev) => {
  const n = selectedNode();
  if (!n) return;
  n.title = ev.target.value;
  commitDebounced();
  renderCanvasOnly();
});
$('#pSub').addEventListener('input', (ev) => {
  const n = selectedNode();
  if (!n) return;
  n.subtitle = ev.target.value;
  commitDebounced();
  renderCanvasOnly();
});
$('#pNote').addEventListener('input', (ev) => {
  const n = selectedNode();
  if (!n) return;
  n.note = ev.target.value;
  commitDebounced();
  renderCanvasOnly();
});
$('#pLabel').addEventListener('input', (ev) => {
  const e = selectedEdge();
  if (!e) return;
  e.label = ev.target.value;
  commitDebounced();
  renderCanvasOnly();
});
$('#pAddRow').addEventListener('click', () => {
  const n = selectedNode();
  if (!n) return;
  if (!n.rows) n.rows = [];
  n.rows.push(['clave', 'valor']);
  commit();
  panelFor = null;
  renderAll();
});
$('#pDuplicate').addEventListener('click', () => {
  const n = selectedNode();
  if (!n) return;
  const copy = JSON.parse(JSON.stringify(n));
  copy.id = uid();
  if (isTimeline()) {
    // el duplicado queda justo después del original en la secuencia
    doc().nodes.splice(doc().nodes.indexOf(n) + 1, 0, copy);
  } else {
    copy.x += 30;
    copy.y += 30;
    doc().nodes.push(copy);
  }
  selection = { type: 'node', ids: [copy.id] };
  commit();
  renderAll();
});
$('#pDeleteNode').addEventListener('click', deleteSelection);
$('#pDeleteEdge').addEventListener('click', deleteSelection);
$('#pDeleteMulti').addEventListener('click', deleteSelection);

function deleteSelection() {
  if (!selection) return;
  if (selection.type === 'node') {
    const ids = new Set(selection.ids);
    doc().nodes = doc().nodes.filter((n) => !ids.has(n.id));
    doc().edges = doc().edges.filter((e) => !ids.has(e.from) && !ids.has(e.to));
  } else {
    doc().edges = doc().edges.filter((e) => e.id !== selection.id);
  }
  selection = null;
  commit();
  renderAll();
}

/* ============================== documentos ============================== */

const HINT_FLOW = 'doble clic: nuevo nodo / editar texto · puerto azul: conectar · ⇧+arrastre: selección múltiple · ⌘C/⌘V copiar y pegar · ⌫ borrar · ⌘Z deshacer · ⌘+rueda: zoom';
const HINT_TIMELINE = 'doble clic: nuevo hito / editar texto · arrastrar: reordenar y elegir lado · ←/→ mover en la secuencia · ↑/↓ cambiar de lado · ⌫ borrar · ⌘Z deshacer · ⌘+rueda: zoom';

function syncDocBar() {
  const sel = $('#docSelect');
  sel.innerHTML = '';
  for (const d of Object.values(store.docs)) {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    if (d.id === store.current) opt.selected = true;
    sel.appendChild(opt);
  }
  if (document.activeElement !== $('#docName')) {
    $('#docName').value = doc().name;
  }
  $('#addNode').textContent = isTimeline() ? '＋ Hito' : '＋ Nodo';
  $('#autoLayout').hidden = isTimeline();
  $('#hint').textContent = isTimeline() ? HINT_TIMELINE : HINT_FLOW;
}

$('#docSelect').addEventListener('change', (ev) => {
  store.current = ev.target.value;
  selection = null;
  panelFor = null;
  resetHistory();
  saveStore();
  renderAll();
});

$('#docName').addEventListener('input', (ev) => {
  doc().name = ev.target.value || 'Sin nombre';
  saveStore();
});
$('#docName').addEventListener('blur', syncDocBar);

const newDocPopup = $('#newDocPopup');

function createDoc(type) {
  const count = Object.keys(store.docs).length + 1;
  const d = type === 'timeline'
    ? seedTimeline('Timeline ' + count)
    : newDoc('Diagrama ' + count);
  store.docs[d.id] = d;
  store.current = d.id;
  selection = null;
  panelFor = null;
  resetHistory();
  saveStore();
  renderAll();
  if (type === 'timeline') fitView();
}

$('#docNew').addEventListener('click', () => {
  if (!newDocPopup.hidden) {
    newDocPopup.hidden = true;
    return;
  }
  const r = $('#docNew').getBoundingClientRect();
  newDocPopup.style.left = r.left + 'px';
  newDocPopup.style.top = (r.bottom + 6) + 'px';
  newDocPopup.hidden = false;
});

$('#newFlow').addEventListener('click', () => {
  newDocPopup.hidden = true;
  createDoc('flow');
});

$('#newTimeline').addEventListener('click', () => {
  newDocPopup.hidden = true;
  createDoc('timeline');
});

document.addEventListener('pointerdown', (ev) => {
  if (newDocPopup.hidden || newDocPopup.contains(ev.target) || ev.target === $('#docNew')) return;
  newDocPopup.hidden = true;
}, true);

$('#docDelete').addEventListener('click', () => {
  if (!confirm(`¿Eliminar “${doc().name}”? Esta acción no se puede deshacer.`)) return;
  delete store.docs[store.current];
  const remaining = Object.keys(store.docs);
  if (!remaining.length) {
    const d = newDoc('Diagrama 1');
    store.docs[d.id] = d;
    store.current = d.id;
  } else {
    store.current = remaining[0];
  }
  selection = null;
  panelFor = null;
  resetHistory();
  saveStore();
  renderAll();
});

/* ============================== interacción ============================== */

let mode = null; // pan | drag | connect

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const v = view();
  return [(clientX - rect.left - v.x) / v.z, (clientY - rect.top - v.y) / v.z];
}

function applyAlignGuides(n, nx, ny, skipIds) {
  const s = sizes[n.id];
  const th = 6 / view().z;
  guides = { x: null, y: null };
  let bestX = null, bestY = null;
  for (const o of doc().nodes) {
    if (o.id === n.id || (skipIds && skipIds.has(o.id))) continue;
    const os = sizes[o.id];
    const oxs = [o.x, o.x + os.w / 2, o.x + os.w];
    const oys = [o.y, o.y + os.h / 2, o.y + os.h];
    const mxs = [nx, nx + s.w / 2, nx + s.w];
    const mys = [ny, ny + s.h / 2, ny + s.h];
    for (const ox of oxs) for (let i = 0; i < 3; i++) {
      const diff = ox - mxs[i];
      if (Math.abs(diff) <= th && (bestX === null || Math.abs(diff) < Math.abs(bestX.diff))) {
        bestX = { diff, guide: ox };
      }
    }
    for (const oy of oys) for (let i = 0; i < 3; i++) {
      const diff = oy - mys[i];
      if (Math.abs(diff) <= th && (bestY === null || Math.abs(diff) < Math.abs(bestY.diff))) {
        bestY = { diff, guide: oy };
      }
    }
  }
  if (bestX) { nx += bestX.diff; guides.x = bestX.guide; }
  if (bestY) { ny += bestY.diff; guides.y = bestY.guide; }
  return [nx, ny];
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0 && ev.button !== 1) return;
  try { canvas.setPointerCapture(ev.pointerId); } catch (_) { /* eventos sintéticos */ }
  const portEl = ev.target.closest && ev.target.classList.contains('port') ? ev.target : null;
  const nodeG = ev.target.closest ? ev.target.closest('g.node') : null;
  let edgeId = null;
  if (ev.target.classList && ev.target.classList.contains('edge-hit')) {
    edgeId = ev.target.dataset.id;
  } else if (ev.target.dataset && ev.target.dataset.editEdge) {
    edgeId = ev.target.dataset.editEdge; // clic sobre la etiqueta de la flecha
  }

  if (portEl && ev.button === 0) {
    mode = { type: 'connect', from: portEl.dataset.node, side: portEl.dataset.side, target: null };
    canvas.classList.add('connecting');
    return;
  }
  if (nodeG && ev.button === 0) {
    const n = getNode(nodeG.dataset.id);
    if (!n) return;
    const inSel = selection && selection.type === 'node' && selection.ids.includes(n.id);
    if (ev.shiftKey) {
      // shift+clic: agrega o quita de la selección, sin arrastrar
      if (inSel) {
        selection.ids = selection.ids.filter((id) => id !== n.id);
        if (!selection.ids.length) selection = null;
      } else if (selection && selection.type === 'node') {
        selection.ids.push(n.id);
      } else {
        selection = { type: 'node', ids: [n.id] };
      }
      renderAll();
      return;
    }
    if (isTimeline()) {
      // en el timeline el arrastre reordena un solo hito
      if (!inSel || selection.ids.length > 1) {
        selection = { type: 'node', ids: [n.id] };
        renderAll();
      }
      const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
      tlDragId = n.id;
      mode = { type: 'dragT', id: n.id, offX: wx - n.x, offY: wy - n.y, moved: false };
      return;
    }
    if (!inSel) {
      selection = { type: 'node', ids: [n.id] };
      renderAll();
    }
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    const ids = selection.ids.slice();
    const orig = {};
    for (const id of ids) {
      const m = getNode(id);
      if (m) orig[id] = [m.x, m.y];
    }
    mode = {
      type: 'drag', primary: n.id, ids, idSet: new Set(ids), orig,
      offX: wx - n.x, offY: wy - n.y, moved: false,
    };
    return;
  }
  if (edgeId && ev.button === 0) {
    selection = { type: 'edge', id: edgeId };
    renderAll();
    mode = null;
    return;
  }
  // fondo: shift = selección por rectángulo; si no, deseleccionar y hacer pan
  if (ev.shiftKey && ev.button === 0) {
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    mode = { type: 'marquee', x0: wx, y0: wy, x1: wx, y1: wy };
    return;
  }
  if (selection) {
    selection = null;
    renderAll();
  }
  mode = { type: 'pan', startX: ev.clientX, startY: ev.clientY, ox: view().x, oy: view().y };
  canvas.classList.add('panning');
});

canvas.addEventListener('pointermove', (ev) => {
  if (!mode) return;
  if (mode.type === 'pan') {
    view().x = mode.ox + (ev.clientX - mode.startX);
    view().y = mode.oy + (ev.clientY - mode.startY);
    applyViewTransform();
    saveStore();
    return;
  }
  if (mode.type === 'drag') {
    const n = getNode(mode.primary);
    if (!n) return;
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    let nx = wx - mode.offX;
    let ny = wy - mode.offY;
    [nx, ny] = applyAlignGuides(n, nx, ny, mode.idSet);
    const dx = Math.round(nx - mode.orig[mode.primary][0]);
    const dy = Math.round(ny - mode.orig[mode.primary][1]);
    if (dx || dy) mode.moved = true;
    for (const id of mode.ids) {
      const m = getNode(id);
      if (!m) continue;
      m.x = mode.orig[id][0] + dx;
      m.y = mode.orig[id][1] + dy;
    }
    renderCanvasOnly();
    renderGuides();
    return;
  }
  if (mode.type === 'dragT') {
    const n = getNode(mode.id);
    if (!n || !tlInfo) return;
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    const nx = Math.round(wx - mode.offX);
    const ny = Math.round(wy - mode.offY);
    if (nx !== n.x || ny !== n.y) mode.moved = true;
    n.x = nx;
    n.y = ny;
    // el lado se elige arrastrando: donde sueltes la tarjeta, ahí se queda
    if (mode.moved) n.side = ny + sizes[n.id].h / 2 < 0 ? 'up' : 'down';
    // índice destino según el centro del hito frente a los puntos del resto
    const ns = doc().nodes;
    const center = n.x + sizes[n.id].w / 2;
    const cur = ns.indexOf(n);
    const others = ns.filter((m) => m.id !== n.id);
    let idx = others.length;
    for (let i = 0; i < others.length; i++) {
      if (center < tlInfo.cx[others[i].id]) { idx = i; break; }
    }
    if (idx !== cur) {
      ns.splice(cur, 1);
      ns.splice(idx, 0, n);
    }
    renderCanvasOnly();
    return;
  }
  if (mode.type === 'marquee') {
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    mode.x1 = wx;
    mode.y1 = wy;
    const z = view().z;
    draftG.innerHTML = '';
    el('rect', {
      x: Math.min(mode.x0, wx), y: Math.min(mode.y0, wy),
      width: Math.abs(wx - mode.x0), height: Math.abs(wy - mode.y0),
      fill: 'rgba(61, 139, 253, 0.08)', stroke: '#3d8bfd',
      'stroke-width': 1 / z, 'stroke-dasharray': `${4 / z} ${3 / z}`,
      'pointer-events': 'none',
    }, draftG);
    return;
  }
  if (mode.type === 'connect') {
    const from = getNode(mode.from);
    if (!from) return;
    const p1 = anchorPoint(from, mode.side);
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    // detecta el nodo bajo el cursor
    mode.target = null;
    for (const n of doc().nodes) {
      if (n.id === mode.from) continue;
      const s = sizes[n.id];
      if (wx >= n.x && wx <= n.x + s.w && wy >= n.y && wy <= n.y + s.h) {
        mode.target = n.id;
        break;
      }
    }
    draftG.innerHTML = '';
    el('path', {
      d: `M ${p1[0]} ${p1[1]} L ${wx} ${wy}`,
      fill: 'none', stroke: '#3d8bfd', 'stroke-width': 1.6,
      'stroke-dasharray': '5 4', 'pointer-events': 'none',
    }, draftG);
    if (mode.target) {
      const t = getNode(mode.target);
      const s = sizes[t.id];
      el('rect', {
        x: t.x - 4, y: t.y - 4, width: s.w + 8, height: s.h + 8,
        rx: NODE_RADIUS + 4, fill: 'none', stroke: '#3d8bfd',
        'stroke-width': 1.6, 'pointer-events': 'none',
      }, draftG);
    }
  }
});

canvas.addEventListener('pointerup', (ev) => {
  if (!mode) return;
  let newEdgeId = null;
  if (mode.type === 'drag' && mode.moved) commit();
  if (mode.type === 'drag' && !mode.moved && mode.ids.length > 1) {
    // clic simple sobre un nodo de una selección múltiple: queda solo ese nodo
    selection = { type: 'node', ids: [mode.primary] };
  }
  if (mode.type === 'dragT') {
    tlDragId = null;
    if (mode.moved) {
      computeSizes(); // coloca el hito en su hueco definitivo antes del commit
      commit();
    }
  }
  if (mode.type === 'marquee') {
    const x0 = Math.min(mode.x0, mode.x1), x1 = Math.max(mode.x0, mode.x1);
    const y0 = Math.min(mode.y0, mode.y1), y1 = Math.max(mode.y0, mode.y1);
    const ids = doc().nodes
      .filter((n) => {
        const s = sizes[n.id];
        return n.x < x1 && n.x + s.w > x0 && n.y < y1 && n.y + s.h > y0;
      })
      .map((n) => n.id);
    selection = ids.length ? { type: 'node', ids } : null;
    draftG.innerHTML = '';
  }
  if (mode.type === 'connect') {
    if (mode.target) {
      const dup = doc().edges.some((e) => e.from === mode.from && e.to === mode.target);
      if (!dup) {
        const def = store.edgeDefaults;
        const edge = {
          id: uid(), from: mode.from, to: mode.target, label: '',
          dashed: def.dashed, both: def.both, thick: def.thick, color: def.color,
        };
        doc().edges.push(edge);
        selection = { type: 'edge', id: edge.id };
        newEdgeId = edge.id;
        commit();
      }
    }
    draftG.innerHTML = '';
  }
  guides = { x: null, y: null };
  canvas.classList.remove('panning', 'connecting');
  mode = null;
  renderAll();
  if (newEdgeId) showEdgePopup(newEdgeId, ev.clientX, ev.clientY);
});

canvas.addEventListener('dblclick', (ev) => {
  const tNode = ev.target.closest ? ev.target.closest('text[data-edit-node]') : null;
  if (tNode) {
    startInlineEdit(tNode);
    return;
  }
  const tEdge = ev.target.closest ? ev.target.closest('text[data-edit-edge]') : null;
  if (tEdge) {
    const e = getEdge(tEdge.dataset.editEdge);
    if (e) startEdgeLabelEdit(e);
    return;
  }
  if (ev.target.classList && ev.target.classList.contains('edge-hit')) {
    const e = getEdge(ev.target.dataset.id);
    if (e) {
      selection = { type: 'edge', id: e.id };
      renderAll();
      startEdgeLabelEdit(e);
    }
    return;
  }
  const noteG = ev.target.closest ? ev.target.closest('[data-note-node]') : null;
  if (noteG) {
    const n = getNode(noteG.dataset.noteNode);
    if (n) {
      selection = { type: 'node', ids: [n.id] };
      panelFor = null;
      renderAll();
      $('#pNote').focus();
      $('#pNote').select();
    }
    return;
  }
  const nodeG = ev.target.closest ? ev.target.closest('g.node') : null;
  if (nodeG) {
    const titleEl = nodeG.querySelector('text[data-edit-field="title"]');
    if (titleEl) startInlineEdit(titleEl);
    return;
  }
  const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
  if (isTimeline()) {
    addMilestoneAt(wx);
    return;
  }
  addNodeAt(wx - 95, wy - 27);
});

/* ============================== edición inline ============================== */

let inlineInput = null;

// Crea el input flotante; getVal/setVal conectan con el modelo.
function spawnInline(opts, getVal, setVal) {
  if (inlineInput) inlineInput.remove();
  const input = document.createElement('input');
  inlineInput = input;
  input.type = 'text';
  input.className = 'inline-edit';
  input.spellcheck = false;
  input.value = getVal();
  const original = input.value;
  input.style.font = `${opts.weight || 400} ${opts.fontSize}px ${opts.fontFamily}`;
  input.style.color = opts.color;
  input.style.background = opts.bg;
  input.style.width = opts.width + 'px';
  input.style.left = opts.left + 'px';
  input.style.top = opts.top + 'px';
  input.style.textAlign = opts.align || 'left';
  if (opts.border) input.style.borderColor = opts.border;
  document.body.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (keep) => {
    if (done) return;
    done = true;
    setVal(keep ? input.value : original);
    input.remove();
    if (inlineInput === input) inlineInput = null;
    panelFor = null;
    commit();
    renderAll();
  };
  input.addEventListener('input', () => {
    setVal(input.value);
    renderCanvasOnly();
  });
  input.addEventListener('keydown', (kev) => {
    kev.stopPropagation();
    if (kev.key === 'Enter') finish(true);
    if (kev.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

function startInlineEdit(textEl) {
  const n = getNode(textEl.dataset.editNode);
  if (!n) return;
  const field = textEl.dataset.editField;
  const ri = +textEl.dataset.editRow;
  const ci = +textEl.dataset.editCol;
  const getVal = () =>
    field === 'title' ? (n.title || '')
    : field === 'subtitle' ? (n.subtitle || '')
    : ((n.rows[ri] || [])[ci] || '');
  const setVal = (v) => {
    if (field === 'title') n.title = v;
    else if (field === 'subtitle') n.subtitle = v;
    else if (n.rows[ri]) n.rows[ri][ci] = v;
  };

  const z = view().z;
  const rect = textEl.getBoundingClientRect();
  const anchor = textEl.getAttribute('text-anchor') || 'start';
  const pal = PALETTES[n.color] || PALETTES.slate;
  const fs = parseFloat(textEl.getAttribute('font-size')) * z;
  const w = Math.max(rect.width + 50 * z, 120 * z);
  const opts = {
    fontFamily: textEl.getAttribute('font-family'),
    weight: textEl.getAttribute('font-weight') || 400,
    fontSize: fs,
    color: textEl.getAttribute('fill'),
    bg: pal.bg,
    width: w,
    top: rect.top + rect.height / 2 - fs / 2 - 6,
    left: rect.left - 8,
  };
  if (anchor === 'middle') {
    opts.left = rect.left + rect.width / 2 - w / 2;
    opts.align = 'center';
  } else if (anchor === 'end') {
    opts.left = rect.right - w + 8;
    opts.align = 'right';
  }
  spawnInline(opts, getVal, setVal);
}

function startEdgeLabelEdit(edge) {
  const geo = edgeGeos[edge.id];
  if (!geo) return;
  const v = view();
  const r = canvas.getBoundingClientRect();
  const fs = 12.5 * v.z;
  const w = 170 * v.z;
  const sx = r.left + v.x + geo.mid[0] * v.z;
  const sy = r.top + v.y + (geo.mid[1] - 7) * v.z;
  const colorKey = EDGE_COLORS[edge.color] ? edge.color : 'gray';
  spawnInline({
    fontFamily: FONT_SANS,
    fontSize: fs,
    color: colorKey === 'gray' ? '#8a8a83' : EDGE_COLORS[colorKey],
    bg: canvasBg(),
    border: 'rgba(61, 139, 253, 0.55)',
    width: w,
    left: sx - w / 2,
    top: sy - fs / 2 - 6,
    align: 'center',
  }, () => edge.label || '', (val) => { edge.label = val; });
}

canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const v = view();
  if (ev.ctrlKey || ev.metaKey) {
    const rect = canvas.getBoundingClientRect();
    const sx = ev.clientX - rect.left;
    const sy = ev.clientY - rect.top;
    const z2 = clamp(v.z * Math.exp(-ev.deltaY * 0.01), 0.2, 3);
    v.x = sx - ((sx - v.x) / v.z) * z2;
    v.y = sy - ((sy - v.y) / v.z) * z2;
    v.z = z2;
  } else {
    v.x -= ev.deltaX;
    v.y -= ev.deltaY;
  }
  applyViewTransform();
  saveStore();
}, { passive: false });

function isTyping() {
  const a = document.activeElement;
  return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
}

/* ============================== copiar / pegar ============================== */

let clipboardMem = null; // respaldo si el portapapeles del sistema no está disponible
let lastPasted = '';
let pasteSeq = 0;

function copySelection() {
  const ns = selectedNodes();
  if (!ns.length) return;
  const ids = new Set(ns.map((n) => n.id));
  const payload = {
    app: 'diagramb',
    nodes: JSON.parse(JSON.stringify(ns)),
    edges: JSON.parse(JSON.stringify(
      doc().edges.filter((e) => ids.has(e.from) && ids.has(e.to))
    )),
  };
  clipboardMem = payload;
  lastPasted = '';
  pasteSeq = 0;
  try {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(() => {});
  } catch (_) { /* sin permiso de portapapeles */ }
}

async function pasteClipboard() {
  let payload = null;
  let raw = 'mem';
  try {
    // si el portapapeles no responde rápido (permiso pendiente), usar el respaldo
    const txt = await Promise.race([
      navigator.clipboard.readText(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 350)),
    ]);
    const p = JSON.parse(txt);
    if (p && p.app === 'diagramb' && Array.isArray(p.nodes)) {
      payload = p;
      raw = txt;
    }
  } catch (_) { /* portapapeles no legible: usar respaldo */ }
  if (!payload) payload = clipboardMem;
  if (!payload || !payload.nodes.length) return;
  pasteSeq = raw === lastPasted ? pasteSeq + 1 : 1;
  lastPasted = raw;
  const off = 24 * pasteSeq;
  const map = {};
  const newNodes = payload.nodes.map((n) => {
    const copy = JSON.parse(JSON.stringify(n));
    map[n.id] = copy.id = uid();
    copy.x += off;
    copy.y += off;
    return copy;
  });
  const newEdges = (payload.edges || [])
    .map((e) => ({ ...e, id: uid(), from: map[e.from], to: map[e.to] }))
    .filter((e) => e.from && e.to);
  doc().nodes.push(...newNodes);
  if (!isTimeline()) doc().edges.push(...newEdges);
  selection = { type: 'node', ids: newNodes.map((n) => n.id) };
  panelFor = null;
  commit();
  renderAll();
}

document.addEventListener('keydown', (ev) => {
  const meta = ev.metaKey || ev.ctrlKey;
  if (ev.key === 'Escape' && !edgePopupEl.hidden) {
    hideEdgePopup();
    return;
  }
  if (meta && ev.key.toLowerCase() === 'z') {
    if (isTyping()) return;
    ev.preventDefault();
    ev.shiftKey ? redo() : undo();
    return;
  }
  if (meta && ev.key.toLowerCase() === 'y') {
    if (isTyping()) return;
    ev.preventDefault();
    redo();
    return;
  }
  if (meta && !isTyping() && ['c', 'x', 'v'].includes(ev.key.toLowerCase())) {
    const k = ev.key.toLowerCase();
    if (k !== 'c') ev.preventDefault();
    if (k === 'c') copySelection();
    if (k === 'x') { copySelection(); deleteSelection(); }
    if (k === 'v') pasteClipboard();
    return;
  }
  if (isTyping()) {
    if (ev.key === 'Escape') document.activeElement.blur();
    return;
  }
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    ev.preventDefault();
    deleteSelection();
    return;
  }
  if (ev.key === 'Escape' && selection) {
    selection = null;
    renderAll();
    return;
  }
  const ns = selectedNodes();
  if (ns.length && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) {
    ev.preventDefault();
    if (isTimeline()) {
      // ←/→ mueven el hito en la secuencia; ↑/↓ fuerzan su lado del eje
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        if (ns.length === 1) moveMilestone(ns[0], ev.key === 'ArrowLeft' ? -1 : 1);
      } else {
        for (const n of ns) n.side = ev.key === 'ArrowUp' ? 'up' : 'down';
        commit();
        renderAll();
      }
      return;
    }
    const step = ev.shiftKey ? 10 : 1;
    for (const n of ns) {
      if (ev.key === 'ArrowUp') n.y -= step;
      if (ev.key === 'ArrowDown') n.y += step;
      if (ev.key === 'ArrowLeft') n.x -= step;
      if (ev.key === 'ArrowRight') n.x += step;
    }
    commitDebounced();
    renderCanvasOnly();
  }
});

/* ============================== barra superior / zoom ============================== */

function addNodeAt(x, y) {
  const n = {
    id: uid(),
    x: Math.round(x),
    y: Math.round(y),
    title: 'Nuevo nodo',
    subtitle: 'descripción',
    color: 'slate',
    rows: [],
  };
  doc().nodes.push(n);
  selection = { type: 'node', ids: [n.id] };
  panelFor = null;
  commit();
  renderAll();
  $('#pTitle').focus();
  $('#pTitle').select();
}

// Inserta un hito en el punto de la secuencia que corresponde a wx.
function addMilestoneAt(wx) {
  const n = {
    id: uid(), x: 0, y: 0,
    title: 'Nuevo hito', subtitle: 'descripción', color: 'slate', rows: [],
  };
  const ns = doc().nodes;
  let idx = ns.length;
  if (tlInfo) {
    for (let i = 0; i < ns.length; i++) {
      if (wx < tlInfo.cx[ns[i].id]) { idx = i; break; }
    }
  }
  ns.splice(idx, 0, n);
  selection = { type: 'node', ids: [n.id] };
  panelFor = null;
  commit();
  renderAll();
  $('#pTitle').focus();
  $('#pTitle').select();
}

// Mueve un hito una posición antes o después en la secuencia.
function moveMilestone(n, delta) {
  const ns = doc().nodes;
  const i = ns.indexOf(n);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ns.length) return;
  ns.splice(i, 1);
  ns.splice(j, 0, n);
  commit();
  renderAll();
}

$('#addNode').addEventListener('click', () => {
  if (isTimeline()) {
    addMilestoneAt(Infinity);
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const [wx, wy] = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  addNodeAt(wx - 95 + Math.random() * 40 - 20, wy - 27 + Math.random() * 40 - 20);
});

function zoomBy(factor) {
  const rect = canvas.getBoundingClientRect();
  const sx = rect.width / 2, sy = rect.height / 2;
  const v = view();
  const z2 = clamp(v.z * factor, 0.2, 3);
  v.x = sx - ((sx - v.x) / v.z) * z2;
  v.y = sy - ((sy - v.y) / v.z) * z2;
  v.z = z2;
  applyViewTransform();
  saveStore();
}

$('#zoomIn').addEventListener('click', () => zoomBy(1.2));
$('#zoomOut').addEventListener('click', () => zoomBy(1 / 1.2));
$('#zoomReset').addEventListener('click', () => {
  const v = view();
  v.z = 1;
  applyViewTransform();
  saveStore();
});
$('#zoomFit').addEventListener('click', fitView);

function contentBounds() {
  const ns = doc().nodes;
  if (!ns.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of ns) {
    const s = sizes[n.id] || nodeSize(n);
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, s.note ? n.y - NOTE_LIFT - 4 : n.y);
    x1 = Math.max(x1, n.x + s.w + (s.note ? s.note.w - NOTE_OVERLAP + 8 : 0));
    y1 = Math.max(y1, n.y + s.h);
    // la inclinación de la nota baja su esquina derecha ~5% de su ancho
    if (s.note) {
      y1 = Math.max(y1, n.y - NOTE_LIFT + s.note.h + Math.ceil(s.note.w * 0.05) + 4);
    }
  }
  if (isTimeline() && tlInfo) {
    x0 = Math.min(x0, tlInfo.x0);
    x1 = Math.max(x1, tlInfo.x1 + 14); // punta de flecha del eje
    y0 = Math.min(y0, -10);
    y1 = Math.max(y1, 10);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function fitView() {
  const b = contentBounds();
  if (!b) return;
  const rect = canvas.getBoundingClientRect();
  const pad = 60;
  const v = view();
  v.z = clamp(Math.min((rect.width - pad * 2) / b.w, (rect.height - pad * 2) / b.h), 0.2, 1.5);
  v.x = (rect.width - b.w * v.z) / 2 - b.x * v.z;
  v.y = (rect.height - b.h * v.z) / 2 - b.y * v.z;
  applyViewTransform();
  saveStore();
}

/* ============================== auto-layout ============================== */

let animating = false;

// Mueve los nodos suavemente a sus posiciones destino y hace commit al final.
function animatePositions(targets, duration = 320) {
  const startPos = {};
  for (const id of Object.keys(targets)) {
    const n = getNode(id);
    if (n) startPos[id] = [n.x, n.y];
  }
  animating = true;
  const t0 = performance.now();
  const frame = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - k, 3);
    for (const [id, [tx, ty]] of Object.entries(targets)) {
      const n = getNode(id);
      if (!n || !startPos[id]) continue;
      n.x = Math.round(startPos[id][0] + (tx - startPos[id][0]) * e);
      n.y = Math.round(startPos[id][1] + (ty - startPos[id][1]) * e);
    }
    renderCanvasOnly();
    if (k < 1) {
      requestAnimationFrame(frame);
    } else {
      animating = false;
      commit();
      renderAll();
    }
  };
  requestAnimationFrame(frame);
}

// Acomoda el diagrama por capas siguiendo las flechas (raíces arriba).
function autoLayout() {
  const ns = doc().nodes;
  if (isTimeline() || ns.length < 2 || animating) return;
  computeSizes();
  const E = doc().edges.filter((e) =>
    e.from !== e.to && getNode(e.from) && getNode(e.to));

  // capa de cada nodo: relajación con tope para tolerar ciclos
  const layer = {};
  for (const n of ns) layer[n.id] = 0;
  for (let i = 0; i < ns.length; i++) {
    let changed = false;
    for (const e of E) {
      if (layer[e.to] < layer[e.from] + 1 && layer[e.from] + 1 <= ns.length) {
        layer[e.to] = layer[e.from] + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // compactar índices de capa y agrupar
  const levels = [...new Set(Object.values(layer))].sort((a, b) => a - b);
  const lmap = new Map(levels.map((v, i) => [v, i]));
  const rows = levels.map(() => []);
  for (const n of ns) rows[lmap.get(layer[n.id])].push(n);

  const preds = {};
  for (const e of E) (preds[e.to] = preds[e.to] || []).push(e.from);

  const HGAP = 60;
  const VGAP = 90;
  const oldB = contentBounds();
  const targets = {};
  const placedX = {}; // centro x ya asignado, para el promedio de los hijos
  let y = 0;
  for (const row of rows) {
    // posición deseada: promedio de los padres ya colocados (reduce cruces)
    const desired = new Map();
    for (const n of row) {
      const ps = (preds[n.id] || []).filter((id) => placedX[id] != null);
      desired.set(n.id, ps.length
        ? ps.reduce((a, id) => a + placedX[id], 0) / ps.length
        : n.x + sizes[n.id].w / 2);
    }
    row.sort((a, b) => desired.get(a.id) - desired.get(b.id) || a.x - b.x);
    const totalW = row.reduce((a, n) => a + sizes[n.id].w, 0) + HGAP * (row.length - 1);
    const center = row.reduce((a, n) => a + desired.get(n.id), 0) / row.length;
    let x = center - totalW / 2;
    let maxH = 0;
    for (const n of row) {
      targets[n.id] = [Math.round(x), Math.round(y)];
      placedX[n.id] = x + sizes[n.id].w / 2;
      x += sizes[n.id].w + HGAP;
      maxH = Math.max(maxH, sizes[n.id].h);
    }
    y += maxH + VGAP;
  }

  // re-centrar el resultado donde estaba el diagrama
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [id, [tx, ty]] of Object.entries(targets)) {
    x0 = Math.min(x0, tx);
    y0 = Math.min(y0, ty);
    x1 = Math.max(x1, tx + sizes[id].w);
    y1 = Math.max(y1, ty + sizes[id].h);
  }
  const dx = Math.round(oldB.x + oldB.w / 2 - (x0 + x1) / 2);
  const dy = Math.round(oldB.y + oldB.h / 2 - (y0 + y1) / 2);
  for (const id of Object.keys(targets)) {
    targets[id][0] += dx;
    targets[id][1] += dy;
  }

  animatePositions(targets);
}

$('#autoLayout').addEventListener('click', autoLayout);

/* ============================== tema ============================== */

const themeToggle = $('#themeToggle');

function applyTheme() {
  document.body.classList.toggle('dark', isDark());
  const dot = dotsPattern.querySelector('circle');
  if (dot) dot.setAttribute('fill', isDark() ? '#3a3a41' : '#d6d6d0');
  themeToggle.textContent = isDark() ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  store.theme = isDark() ? 'light' : 'dark';
  saveStore();
  applyTheme();
  renderAll();
});

/* ============================== compartir por URL ============================== */

function b64urlEncode(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Prefijo 'c' = deflate comprimido, 'r' = sin comprimir (navegadores viejos).
async function deflateB64(str) {
  const bytes = new TextEncoder().encode(str);
  if (typeof CompressionStream === 'undefined') return 'r' + b64urlEncode(bytes);
  const stream = new Blob([bytes]).stream()
    .pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  return 'c' + b64urlEncode(buf);
}

async function inflateFromB64(data) {
  const bytes = b64urlDecode(data.slice(1));
  if (data[0] === 'r') return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return await new Response(stream).text();
}

function flashButton(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = old;
    btn.disabled = false;
  }, 1400);
}

$('#shareBtn').addEventListener('click', async () => {
  const d = doc();
  if (!d.nodes.length) { alert('El diagrama está vacío.'); return; }
  const data = await deflateB64(JSON.stringify(
    { app: 'diagramb', name: d.name, type: d.type, nodes: d.nodes, edges: d.edges }
  ));
  const url = location.href.split('#')[0] + '#d=' + data;
  try {
    await navigator.clipboard.writeText(url);
    flashButton($('#shareBtn'), '¡Enlace copiado!');
  } catch (_) {
    prompt('Copia el enlace:', url);
  }
});

async function handleShareHash() {
  if (!location.hash.startsWith('#d=')) return;
  const data = location.hash.slice(3);
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const p = JSON.parse(await inflateFromB64(data));
    if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) {
      throw new Error('estructura inválida');
    }
    const d = newDoc(p.name || 'Compartido', p.type === 'timeline' ? 'timeline' : 'flow');
    d.nodes = p.nodes;
    d.edges = p.edges;
    store.docs[d.id] = d;
    store.current = d.id;
    selection = null;
    panelFor = null;
    resetHistory();
    saveStore();
    renderAll();
    fitView();
  } catch (err) {
    alert('No se pudo abrir el diagrama compartido: ' + err.message);
  }
}

/* ============================== exportar ============================== */

function buildExportSvg() {
  computeSizes();
  const b = contentBounds();
  if (!b) return null;
  const pad = 48;
  const w = Math.ceil(b.w + pad * 2);
  const h = Math.ceil(b.h + pad * 2);
  const svg = el('svg', {
    xmlns: NS,
    width: w,
    height: h,
    viewBox: `${b.x - pad} ${b.y - pad} ${w} ${h}`,
    'font-family': FONT_SANS,
  });
  const defs = el('defs', {}, svg);
  ensureEdgeMarkers(defs);
  const bg = isDark() ? '#17171a' : '#ffffff';
  el('rect', {
    x: b.x - pad, y: b.y - pad, width: w, height: h, fill: bg,
  }, svg);
  for (const e of doc().edges) {
    const g = renderEdge(e, { forExport: true, bg });
    if (g) svg.appendChild(g);
  }
  if (isTimeline()) renderTimelineAxis(svg, { bg });
  for (const n of doc().nodes) svg.appendChild(renderNode(n, { forExport: true }));
  return { svg, w, h };
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const fileSlug = () =>
  (doc().name || 'diagrama').toLowerCase().replace(/[^a-z0-9á-ú]+/gi, '-').replace(/^-+|-+$/g, '') || 'diagrama';

$('#exportSvg').addEventListener('click', () => {
  const out = buildExportSvg();
  if (!out) { alert('El diagrama está vacío.'); return; }
  const str = new XMLSerializer().serializeToString(out.svg);
  downloadBlob(new Blob([str], { type: 'image/svg+xml' }), fileSlug() + '.svg');
});

$('#exportPng').addEventListener('click', () => {
  const out = buildExportSvg();
  if (!out) { alert('El diagrama está vacío.'); return; }
  const str = new XMLSerializer().serializeToString(out.svg);
  const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const cnv = document.createElement('canvas');
    cnv.width = out.w * scale;
    cnv.height = out.h * scale;
    const ctx = cnv.getContext('2d');
    ctx.fillStyle = isDark() ? '#17171a' : '#ffffff';
    ctx.fillRect(0, 0, cnv.width, cnv.height);
    ctx.drawImage(img, 0, 0, cnv.width, cnv.height);
    URL.revokeObjectURL(url);
    cnv.toBlob((blob) => downloadBlob(blob, fileSlug() + '.png'), 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    alert('No se pudo generar el PNG.');
  };
  img.src = url;
});

$('#exportJson').addEventListener('click', () => {
  const d = doc();
  const data = JSON.stringify(
    { app: 'diagramb', name: d.name, type: d.type, nodes: d.nodes, edges: d.edges }, null, 2
  );
  downloadBlob(new Blob([data], { type: 'application/json' }), fileSlug() + '.json');
});

$('#importJson').addEventListener('click', () => $('#importFile').click());

$('#importFile').addEventListener('change', (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const p = JSON.parse(reader.result);
      if (!Array.isArray(p.nodes) || !Array.isArray(p.edges)) {
        throw new Error('el archivo no tiene nodos y flechas');
      }
      const d = newDoc(p.name || file.name.replace(/\.json$/i, '') || 'Importado',
        p.type === 'timeline' ? 'timeline' : 'flow');
      d.nodes = p.nodes;
      d.edges = p.edges;
      store.docs[d.id] = d;
      store.current = d.id;
      selection = null;
      panelFor = null;
      resetHistory();
      saveStore();
      renderAll();
      fitView();
    } catch (err) {
      alert('No se pudo importar el JSON: ' + err.message);
    }
  };
  reader.readAsText(file);
});

/* ============================== inicio ============================== */

loadStore();
ensureEdgeMarkers(canvas.querySelector('defs'));
buildSwatches('#pColors');
buildSwatches('#pColorsMulti');
buildSideControl('#pSide');
buildSideControl('#pSideMulti');
buildAlignControls();
buildEdgeControls('#pEdgeControls', selectedEdge);
buildEdgeControls('#popupEdgeControls', popupEdge);
applyTheme();
resetHistory();
renderAll();
handleShareHash();
window.addEventListener('resize', renderGuides);

// API mínima para depuración y pruebas automatizadas
window.__diagramb = {
  get doc() { return doc(); },
  get selection() { return selection; },
  get sizes() { return sizes; },
  buildExportSvg,
  undo,
  redo,
  renderAll,
  copySelection,
  pasteClipboard,
  deflateB64,
  inflateFromB64,
};

})();
