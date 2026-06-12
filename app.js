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
const F_ROW = `400 12.5px ${FONT_MONO}`;

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

const EDGE_COLOR = '#9b9b94';
const CANVAS_BG = '#f6f6f4';
const NODE_RADIUS = 12;
const PAD_X = 18;

/* ============================== medición de texto ============================== */

const measureCtx = document.createElement('canvas').getContext('2d');

function textWidth(str, font) {
  measureCtx.font = font;
  return measureCtx.measureText(str || '').width;
}

// Calcula tamaño y disposición interna de un nodo a partir de su contenido.
function nodeSize(n) {
  const rows = (n.rows || []).filter((r) => r[0] || r[1]);
  const titleW = textWidth(n.title, F_TITLE);
  const subW = textWidth(n.subtitle, F_SUB);

  if (!rows.length) {
    const w = clamp(Math.max(titleW, subW) + PAD_X * 2 + 8, 170, 620);
    const h = n.subtitle ? 72 : 54;
    return { w, h, rows, keyColW: 0 };
  }

  let keyColW = 0;
  let valColW = 0;
  for (const [k, v] of rows) {
    keyColW = Math.max(keyColW, textWidth(k, F_ROW));
    valColW = Math.max(valColW, textWidth(v, F_ROW));
  }
  const colGap = 48;
  const w = clamp(
    Math.max(titleW, subW, keyColW + colGap + valColW) + PAD_X * 2,
    280, 860
  );
  let h = 16 + 20;                 // padding superior + título
  if (n.subtitle) h += 19;
  h += 12 + rows.length * 22 + 14; // separación + filas + padding inferior
  return { w, h, rows, keyColW };
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

function newDoc(name) {
  return {
    id: uid(),
    name,
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
      ['endpoint', 'acción interna'],
      ['hold_partner_assign', 'NOTIFY_ORDER_HOLD'],
      ['assign_to_partner_v2', 'ASSIGN_TO_PARTNER'],
    ]);
  const c = mk(440, 450, 'assign-gateway', 'obtiene store_id', 'indigo');
  const e = mk(437, 580, '¿Tienda migrada?', 'consulta en Statsig', 'amber');
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

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.docs && parsed.current && parsed.docs[parsed.current]) {
        store = parsed;
        return;
      }
    }
  } catch (_) { /* almacenamiento corrupto: se regenera */ }
  const d = seedDoc();
  store = { current: d.id, docs: { [d.id]: d } };
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

function edgeGeometryFor({ a, b, sideA, sideB, offA, offB }) {
  const p1 = shiftAlongSide(anchorPoint(a, sideA), sideA, offA);
  let p2 = shiftAlongSide(anchorPoint(b, sideB), sideB, offB);
  const nB = SIDE_NORMALS[sideB];
  p2 = [p2[0] + nB[0] * 5, p2[1] + nB[1] * 5]; // pequeño espacio para la punta
  const nA = SIDE_NORMALS[sideA];
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

/* ============================== render ============================== */

const canvas = $('#canvas');
const worldG = $('#world');
const edgesG = $('#edgesG');
const nodesG = $('#nodesG');
const guidesG = $('#guidesG');
const draftG = $('#draftG');
const dotsPattern = $('#dots');

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

  el('rect', { width: s.w, height: s.h, rx: NODE_RADIUS, fill: pal.bg }, g);

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
      editable.push([addText(g, row[0], PAD_X, y,
        { fill: pal.sub, size: 12.5, mono: true }), 'row', ri, 0]);
      editable.push([addText(g, row[1], valX, y,
        { fill: pal.val, size: 12.5, mono: true, anchor: 'end' }), 'row', ri, 1]);
    }
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
    for (const side of ['top', 'bottom', 'left', 'right']) {
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
  el('path', {
    d: geo.d,
    fill: 'none',
    stroke: isSel ? '#3d8bfd' : EDGE_COLOR,
    'stroke-width': 1.6,
    'marker-end': isSel ? 'url(#arrowSel)' : 'url(#arrow)',
  }, g);
  if (edge.label) {
    addText(g, edge.label, geo.mid[0], geo.mid[1] - 7, {
      fill: isSel ? '#3d8bfd' : '#8a8a83', size: 12.5, anchor: 'middle',
    }).setAttribute('style',
      `paint-order: stroke; stroke: ${opts.bg || CANVAS_BG}; stroke-width: 5px;`);
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
  nodesG.innerHTML = '';
  for (const n of doc().nodes) nodesG.appendChild(renderNode(n));
  renderGuides();
  applyViewTransform();
  syncPanel();
  syncDocBar();
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
      buildRowsEditor(n);
    }
  } else if (e) {
    if (panelFor !== key) $('#pLabel').value = e.label || '';
  } else if (multi) {
    $('#pMultiCount').textContent = ns.length + ' nodos seleccionados';
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
  copy.x += 30;
  copy.y += 30;
  doc().nodes.push(copy);
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

$('#docNew').addEventListener('click', () => {
  const d = newDoc('Diagrama ' + (Object.keys(store.docs).length + 1));
  store.docs[d.id] = d;
  store.current = d.id;
  selection = null;
  panelFor = null;
  resetHistory();
  saveStore();
  renderAll();
});

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
  const edgeHit = ev.target.classList && ev.target.classList.contains('edge-hit') ? ev.target : null;

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
  if (edgeHit && ev.button === 0) {
    selection = { type: 'edge', id: edgeHit.dataset.id };
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

canvas.addEventListener('pointerup', () => {
  if (!mode) return;
  if (mode.type === 'drag' && mode.moved) commit();
  if (mode.type === 'drag' && !mode.moved && mode.ids.length > 1) {
    // clic simple sobre un nodo de una selección múltiple: queda solo ese nodo
    selection = { type: 'node', ids: [mode.primary] };
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
        const edge = { id: uid(), from: mode.from, to: mode.target, label: '' };
        doc().edges.push(edge);
        selection = { type: 'edge', id: edge.id };
        commit();
      }
    }
    draftG.innerHTML = '';
  }
  guides = { x: null, y: null };
  canvas.classList.remove('panning', 'connecting');
  mode = null;
  renderAll();
});

canvas.addEventListener('dblclick', (ev) => {
  if (ev.target.dataset && ev.target.dataset.editNode) {
    startInlineEdit(ev.target);
    return;
  }
  const nodeG = ev.target.closest ? ev.target.closest('g.node') : null;
  if (nodeG) {
    const titleEl = nodeG.querySelector('text[data-edit-field="title"]');
    if (titleEl) startInlineEdit(titleEl);
    return;
  }
  const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
  addNodeAt(wx - 95, wy - 27);
});

/* ============================== edición inline ============================== */

let inlineInput = null;

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

  if (inlineInput) inlineInput.remove();
  const z = view().z;
  const rect = textEl.getBoundingClientRect();
  const anchor = textEl.getAttribute('text-anchor') || 'start';
  const pal = PALETTES[n.color] || PALETTES.slate;
  const fs = parseFloat(textEl.getAttribute('font-size')) * z;
  const w = Math.max(rect.width + 50 * z, 120 * z);

  const input = document.createElement('input');
  inlineInput = input;
  input.type = 'text';
  input.className = 'inline-edit';
  input.spellcheck = false;
  input.value = getVal();
  const original = input.value;
  input.style.font =
    `${textEl.getAttribute('font-weight') || 400} ${fs}px ${textEl.getAttribute('font-family')}`;
  input.style.color = textEl.getAttribute('fill');
  input.style.background = pal.bg;
  input.style.width = w + 'px';
  input.style.top = (rect.top + rect.height / 2 - fs / 2 - 6) + 'px';
  if (anchor === 'middle') {
    input.style.left = (rect.left + rect.width / 2 - w / 2) + 'px';
    input.style.textAlign = 'center';
  } else if (anchor === 'end') {
    input.style.left = (rect.right - w + 8) + 'px';
    input.style.textAlign = 'right';
  } else {
    input.style.left = (rect.left - 8) + 'px';
  }
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
  doc().edges.push(...newEdges);
  selection = { type: 'node', ids: newNodes.map((n) => n.id) };
  panelFor = null;
  commit();
  renderAll();
}

document.addEventListener('keydown', (ev) => {
  const meta = ev.metaKey || ev.ctrlKey;
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

$('#addNode').addEventListener('click', () => {
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
    y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x + s.w);
    y1 = Math.max(y1, n.y + s.h);
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
  const marker = el('marker', {
    id: 'arrow', viewBox: '0 0 10 10', refX: 8.5, refY: 5,
    markerWidth: 7.5, markerHeight: 7.5, orient: 'auto-start-reverse',
  }, defs);
  el('path', { d: 'M0 0 L10 5 L0 10 z', fill: EDGE_COLOR }, marker);
  el('rect', {
    x: b.x - pad, y: b.y - pad, width: w, height: h, fill: '#ffffff',
  }, svg);
  for (const e of doc().edges) {
    const g = renderEdge(e, { forExport: true, bg: '#ffffff' });
    if (g) svg.appendChild(g);
  }
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
    ctx.fillStyle = '#ffffff';
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
    { app: 'diagramb', name: d.name, nodes: d.nodes, edges: d.edges }, null, 2
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
      const d = newDoc(p.name || file.name.replace(/\.json$/i, '') || 'Importado');
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
buildSwatches('#pColors');
buildSwatches('#pColorsMulti');
resetHistory();
renderAll();
window.addEventListener('resize', renderGuides);

// API mínima para depuración y pruebas automatizadas
window.__diagramb = {
  get doc() { return doc(); },
  get selection() { return selection; },
  buildExportSvg,
  undo,
  redo,
  renderAll,
  copySelection,
  pasteClipboard,
};

})();
