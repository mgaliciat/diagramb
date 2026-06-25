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
const getTl = (id) => doc().timelines.find((t) => t.id === id);
// hitos de una línea de tiempo, en el orden del arreglo de nodos
const tlMembers = (tlId) => doc().nodes.filter((n) => n.tl === tlId);

function newDoc(name) {
  return {
    id: uid(),
    name,
    nodes: [],
    edges: [],
    timelines: [], // [{ id, x, y }]: ejes que conviven con el diagrama libre
    view: { x: 0, y: 0, z: 1 },
  };
}

// Compatibilidad: los documentos viejos tipo 'timeline' se convierten en un
// canvas normal con una línea de tiempo; los de flujo solo ganan el campo.
function normalizeDoc(d) {
  if (!d.timelines) d.timelines = [];
  if (d.type === 'timeline' && d.nodes.length) {
    const tl = { id: uid(), x: 0, y: 0 };
    d.timelines.push(tl);
    for (const n of d.nodes) n.tl = tl.id;
  }
  delete d.type;
  return d;
}

// Ejemplo por defecto: muestra todas las bondades del editor (tarjetas con
// tabla y markdown, notas adhesivas, colores, flechas con estilo y una línea
// de tiempo conviviendo en el mismo canvas) con datos de Pokémon.
function seedDoc() {
  const d = newDoc('Pokémon · combate y medallas');
  const mk = (x, y, title, subtitle, color, rows) => {
    const n = { id: uid(), x, y, title, subtitle, color, rows: rows || [] };
    d.nodes.push(n);
    return n.id;
  };
  const note = (txt) => { d.nodes[d.nodes.length - 1].note = txt; };

  // ----- Diagrama de flujo: cómo afrontar un combate salvaje -----
  const a = mk(440, 60, 'Encuentro salvaje', 'hierba alta · Ruta 3', 'forest');
  note('Los Pokémon salvajes huyen si tu nivel es mucho mayor.');
  const b = mk(420, 210, '¿De qué tipo es el rival?', 'revísalo en la Pokédex', 'indigo');
  const tabla = mk(800, 150, 'Tabla de tipos · Charmander', 'ataques de Fuego 🔥', 'amber', [
    ['**defensor**', '**daño**'],
    ['`Planta`', '×2 súper eficaz'],
    ['`Bicho`', '×2 súper eficaz'],
    ['`Agua`', '×0.5 poco eficaz'],
    ['`Roca`', '×0.5 poco eficaz'],
  ]);
  const c = mk(180, 380, 'Usar Ascuas', 'golpe con ventaja', 'rust');
  const e = mk(700, 380, 'Cambiar a Squirtle', 'matchup más seguro', 'blue');
  const f = mk(430, 560, '¿Bajó su vida?', 'apunta a la zona roja', 'indigo');
  const g = mk(170, 740, 'Lanzar Poké Ball', '¡captura!', 'teal', [
    ['**Poké Ball**', '×1.0'],
    ['**Súper Ball**', '×1.5'],
    ['**Ultra Ball**', '×2.0'],
  ]);
  note('Más fácil si está dormido o paralizado.');
  const h = mk(690, 740, 'Seguir atacando', 'gana experiencia', 'olive');

  const link = (from, to, label, extra) =>
    d.edges.push(Object.assign({ id: uid(), from, to, label: label || '' }, extra));
  link(a, b, 'aparece');
  link(b, tabla, 'consulta', { dashed: true, both: true, color: 'purple' });
  link(b, c, 'Planta / Bicho', { color: 'green', thick: true });
  link(b, e, 'Agua / Roca', { color: 'red' });
  link(c, f);
  link(e, f);
  link(f, g, 'sí, debilitado', { color: 'green' });
  link(f, h, 'aún fuerte', { color: 'red', dashed: true });
  link(h, f, 'reintentar', { color: 'amber' });

  // ----- Línea de tiempo: las 8 medallas de Kanto -----
  const tl = { id: uid(), x: 240, y: 1060 };
  d.timelines.push(tl);
  const hito = (title, subtitle, color, rows, side) => {
    const n = { id: uid(), x: 0, y: 0, tl: tl.id, title, subtitle, color, rows: rows || [] };
    if (side) n.side = side;
    d.nodes.push(n);
    return n;
  };
  hito('Roca', 'Brock · Plateada', 'slate', [
    ['**tipo**', '`Roca`'],
    ['**premio**', 'MT Avalancha'],
  ]);
  hito('Cascada', 'Misty · Celeste', 'blue');
  hito('Trueno', 'Lt. Surge · Carmín', 'amber');
  hito('Arcoíris', 'Erika · Azulona', 'magenta');
  hito('Alma', 'Sabrina · Azafrán', 'plum', [], 'up');
  hito('Volcán', 'Blaine · Canela', 'rust');
  hito('Tierra', 'Giovanni · Verde', 'forest');
  d.nodes[d.nodes.length - 1].note = 'Giovanni es el líder secreto del Team Rocket.';
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
  for (const d of Object.values(store.docs)) normalizeDoc(d);
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
    cloud.schedulePush(store.current);
  }, 150);
}

/* ============================== cuentas + sync en la nube ============================== */
//
// El acceso es siempre opcional: sin sesión la app funciona exactamente igual
// que antes, guardando todo en localStorage. Al iniciar sesión, cada diagrama
// se sincroniza con el backend (PUT /api/v1/diagrams/{id}) y al entrar se
// fusionan los diagramas de la nube con los locales (gana el más reciente).

const AUTH_KEY = 'diagramb.auth';

// Firma de contenido de un diagrama. Ignora `updatedAt` (la marca de tiempo no
// debe dispararse a sí misma) y `view` (la cámara es local: mover/zoom no debe
// provocar sincronización). El payload sí incluye ambos al subir.
function docSig(d) {
  const c = { ...d };
  delete c.updatedAt;
  delete c.view;
  return JSON.stringify(c);
}

const cloud = {
  base: '/api/v1',
  token: null,
  user: null,
  pushTimers: {},
  lastSig: {},
  status: 'idle',

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h.Authorization = 'Bearer ' + this.token;
    return h;
  },

  loadSession() {
    try {
      const a = JSON.parse(localStorage.getItem(AUTH_KEY));
      if (a && a.token) { this.token = a.token; this.user = a.user || null; }
    } catch (_) { /* sesión corrupta: se ignora */ }
  },
  saveSession() {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ token: this.token, user: this.user }));
  },
  clearSession() {
    localStorage.removeItem(AUTH_KEY);
    this.token = null;
    this.user = null;
  },

  // Restaura la sesión al arrancar: valida el token y descarga los diagramas.
  async init() {
    this.loadSession();
    updateAuthUI();
    if (!this.token) return;
    try {
      const res = await fetch(this.base + '/auth/me', { headers: this.headers() });
      if (res.status === 401) { this.handle401(); return; }
      if (!res.ok) { this.setStatus('offline'); return; }
      this.user = await res.json();
      this.saveSession();
      updateAuthUI();
      await this.pullAll();
    } catch (_) { this.setStatus('offline'); }
  },

  async authRequest(path, body) {
    const res = await fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo completar la solicitud');
    this.token = data.token;
    this.user = data.user;
    this.saveSession();
    updateAuthUI();
    await this.pullAll();
    return data;
  },
  login(email, password) { return this.authRequest('/auth/login', { email, password }); },
  register(name, email, password) { return this.authRequest('/auth/register', { name, email, password }); },

  logout() {
    this.clearSession();
    this.pushTimers = {};
    this.lastSig = {};
    this.setStatus('idle');
    updateAuthUI();
  },

  handle401() {
    // Token expirado o inválido: se cierra la sesión sin tocar los diagramas
    // locales, que siguen disponibles sin conexión. A diferencia de cerrar
    // sesión a propósito, aquí avisamos al usuario para que vuelva a entrar.
    this.clearSession();
    this.setStatus('idle');
    updateAuthUI();
    showSessionExpired();
  },

  setStatus(s) {
    this.status = s;
    const elS = $('#syncStatus');
    if (!elS) return;
    elS.textContent = ({
      syncing: 'Sincronizando…',
      synced: 'Sincronizado',
      offline: 'Sin conexión',
      idle: '',
    })[s] || '';
  },

  // Descarga todos los diagramas del usuario y los fusiona con los locales.
  async pullAll() {
    if (!this.token) return;
    this.setStatus('syncing');
    let rows;
    try {
      const res = await fetch(this.base + '/diagrams', { headers: this.headers() });
      if (res.status === 401) { this.handle401(); return; }
      if (!res.ok) throw new Error('list');
      rows = await res.json();
    } catch (_) { this.setStatus('offline'); return; }

    let changed = false;
    const cloudIds = new Set();
    for (const row of rows) {
      const cloudDoc = row.payload;
      if (!cloudDoc || typeof cloudDoc !== 'object') continue;
      cloudIds.add(row.id);
      cloudDoc.id = row.id;
      cloudDoc.updatedAt = row.client_updated_at || 0;
      normalizeDoc(cloudDoc);
      const local = store.docs[row.id];
      const localTs = local ? (local.updatedAt || 0) : -1;
      if (!local || (cloudDoc.updatedAt >= localTs)) {
        store.docs[row.id] = cloudDoc;
        this.lastSig[row.id] = docSig(cloudDoc);
        changed = true;
      }
    }
    // Diagramas creados sin sesión: súbelos a la nube.
    for (const id of Object.keys(store.docs)) {
      if (!cloudIds.has(id)) this.schedulePush(id);
    }
    if (!store.docs[store.current]) {
      store.current = Object.keys(store.docs)[0];
      changed = true;
    }
    if (changed) {
      saveStore();
      selection = null;
      panelFor = null;
      resetHistory();
      syncDocBar();
      renderAll();
    }
    this.setStatus('synced');
  },

  schedulePush(docId) {
    if (!this.token) return;
    const d = store.docs[docId];
    if (!d) return;
    const sig = docSig(d);
    if (this.lastSig[docId] === sig) return; // sin cambios reales
    this.lastSig[docId] = sig;
    clearTimeout(this.pushTimers[docId]);
    this.pushTimers[docId] = setTimeout(() => this.pushDoc(docId), 800);
  },

  async pushDoc(docId) {
    const d = store.docs[docId];
    if (!d || !this.token) return;
    this.setStatus('syncing');
    const ts = Date.now();
    d.updatedAt = ts;
    try {
      const res = await fetch(this.base + '/diagrams/' + encodeURIComponent(docId), {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify({ name: d.name || 'Sin nombre', payload: d, client_updated_at: ts }),
      });
      if (res.status === 401) { this.handle401(); return; }
      if (!res.ok) throw new Error('push');
      this.setStatus('synced');
    } catch (_) { this.setStatus('offline'); }
  },

  async deleteDoc(docId) {
    delete this.lastSig[docId];
    clearTimeout(this.pushTimers[docId]);
    if (!this.token) return;
    try {
      const res = await fetch(this.base + '/diagrams/' + encodeURIComponent(docId), {
        method: 'DELETE',
        headers: this.headers(),
      });
      if (res.status === 401) { this.handle401(); return; }
    } catch (_) { /* se reintenta en el próximo arranque vía fusión */ }
  },
};

/* ============================== historial (deshacer) ============================== */

const snapshot = () =>
  JSON.stringify({ nodes: doc().nodes, edges: doc().edges, timelines: doc().timelines });

function resetHistory() {
  history = [snapshot()];
  hIndex = 0;
}

function commit() {
  const snap = snapshot();
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
  doc().timelines = data.timelines || [];
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

// Tarjetas ajenas a la flecha, como cajas { id, box: [x, y, w, h] } infladas.
function nodeBoxes(skipA, skipB) {
  const out = [];
  for (const n of doc().nodes) {
    if (n.id === skipA || n.id === skipB) continue;
    const s = sizes[n.id];
    if (!s) continue;
    out.push({ id: n.id, box: [n.x - 6, n.y - 6, s.w + 12, s.h + 12] });
  }
  return out;
}

function cubicSamples(P0, C1, C2, P3, out) {
  for (let i = 1; i < 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    out.push([
      u * u * u * P0[0] + 3 * u * u * t * C1[0] + 3 * u * t * t * C2[0] + t * t * t * P3[0],
      u * u * u * P0[1] + 3 * u * u * t * C1[1] + 3 * u * t * t * C2[1] + t * t * t * P3[1],
    ]);
  }
  return out;
}

function hitBoxes(samples, candidates) {
  const hit = [];
  for (const c of candidates) {
    const [bx, by, bw, bh] = c.box;
    if (samples.some(([x, y]) => x >= bx && x <= bx + bw && y >= by && y <= by + bh)) {
      hit.push(c);
    }
  }
  return hit;
}

// Punto del trazo, lo más cercano posible al medio, donde la etiqueta
// cabe sin pisar ninguna tarjeta. Si ninguno queda libre, usa el medio.
function bestLabelSpot(label, samples, fallback, candidates) {
  if (!label) return fallback;
  const w = textWidth(label, `400 12.5px ${FONT_SANS}`) + 12;
  const fits = (pt) => {
    const lx = pt[0] - w / 2;
    const ly = pt[1] - 19;
    return !candidates.some(({ box }) =>
      lx < box[0] + box[2] && box[0] < lx + w &&
      ly < box[1] + box[3] && box[1] < ly + 22);
  };
  if (fits(fallback)) return fallback;
  const mid = (samples.length - 1) / 2;
  const order = samples
    .map((p, i) => [Math.abs(i - mid), p])
    .sort((q, r) => q[0] - r[0]);
  for (const [, p] of order) {
    if (fits(p)) return p;
  }
  return fallback;
}

// Ruta de respaldo cuando el arqueo no alcanza: recorre un carril lateral
// despejado junto a los estorbos y entra al destino por su lado natural.
// Se amplía iterativamente hasta verificar por muestreo que no toca nada.
function laneGeometry(e, p1, p2, nA, nB, axis, candidates, firstHits) {
  const main = 1 - axis; // eje de avance de la flecha
  const dir = p2[main] >= p1[main] ? 1 : -1;
  const straight = (p1[axis] + p2[axis]) / 2;

  const attempt = (side) => {
    const seen = new Set(firstHits.map((h) => h.id));
    const blockers = [...firstHits];
    for (let i = 0; i < 5; i++) {
      let lo = Infinity, hi = -Infinity, m0 = Infinity, m1 = -Infinity;
      for (const { box } of blockers) {
        lo = Math.min(lo, box[axis]);
        hi = Math.max(hi, box[axis] + box[axis + 2]);
        m0 = Math.min(m0, box[main]);
        m1 = Math.max(m1, box[main] + box[main + 2]);
      }
      const lane = side < 0 ? lo - 26 : hi + 26;
      const w1 = [];
      const w2 = [];
      w1[axis] = lane;
      w2[axis] = lane;
      w1[main] = dir > 0 ? m0 - 20 : m1 + 20;
      w2[main] = dir > 0 ? m1 + 20 : m0 - 20;
      const cA = [p1[0] + nA[0] * 40, p1[1] + nA[1] * 40];
      const cB = [p2[0] + nB[0] * 40, p2[1] + nB[1] * 40];
      const cW1 = [];
      const cW2 = [];
      cW1[axis] = lane;
      cW1[main] = w1[main] - dir * 32;
      cW2[axis] = lane;
      cW2[main] = w2[main] + dir * 32;
      const samples = cubicSamples(p1, cA, cW1, w1, []);
      for (let j = 1; j < 8; j++) {
        const t = j / 8;
        samples.push([w1[0] + (w2[0] - w1[0]) * t, w1[1] + (w2[1] - w1[1]) * t]);
      }
      cubicSamples(w2, cW2, cB, p2, samples);
      const newHits = hitBoxes(samples, candidates);
      if (!newHits.length) {
        const center = [(w1[0] + w2[0]) / 2, (w1[1] + w2[1]) / 2];
        return {
          d: `M ${p1[0]} ${p1[1]} C ${cA[0]} ${cA[1]}, ${cW1[0]} ${cW1[1]}, ${w1[0]} ${w1[1]} ` +
            `L ${w2[0]} ${w2[1]} ` +
            `C ${cW2[0]} ${cW2[1]}, ${cB[0]} ${cB[1]}, ${p2[0]} ${p2[1]}`,
          mid: bestLabelSpot(e && e.label, samples, center, candidates),
        };
      }
      let grew = false;
      for (const h of newHits) {
        if (!seen.has(h.id)) {
          seen.add(h.id);
          blockers.push(h);
          grew = true;
        }
      }
      if (!grew) return null; // los mismos estorbos: por este lado no se puede
    }
    return null;
  };

  let lo = Infinity, hi = -Infinity;
  for (const { box } of firstHits) {
    lo = Math.min(lo, box[axis]);
    hi = Math.max(hi, box[axis] + box[axis + 2]);
  }
  const firstSide = straight - lo < hi - straight ? -1 : 1;
  return attempt(firstSide) || attempt(-firstSide);
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

  // si el trazo atraviesa tarjetas ajenas, primero se intenta arquear la
  // curva hacia el costado libre; si no alcanza, se enruta por un carril
  const axis = sideA === 'top' || sideA === 'bottom' ? 0 : 1;
  const candidates = nodeBoxes(a.id, b.id);
  let samples = cubicSamples(p1, c1, c2, p2, []);
  let hits = hitBoxes(samples, candidates);
  const firstHits = hits;
  for (let pass = 0; pass < 3 && hits.length; pass++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const { box } of hits) {
      lo = Math.min(lo, box[axis]);
      hi = Math.max(hi, box[axis] + box[axis + 2]);
    }
    const cur = (p1[axis] + 3 * c1[axis] + 3 * c2[axis] + p2[axis]) / 8;
    const target = cur - lo < hi - cur ? lo - 26 : hi + 26;
    // mover ambos controles desplaza el punto medio 3/4 de lo movido
    const off = (target - cur) / 0.75;
    c1[axis] += off;
    c2[axis] += off;
    samples = cubicSamples(p1, c1, c2, p2, []);
    hits = hitBoxes(samples, candidates);
  }
  if (hits.length) {
    const lane = laneGeometry(e, p1, p2, nA, nB, axis, candidates, firstHits);
    if (lane) return lane;
  }

  const mid = [
    (p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8,
    (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8,
  ];
  return {
    d: `M ${p1[0]} ${p1[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`,
    mid: bestLabelSpot(e && e.label, samples, mid, candidates),
  };
}

/* ============================== línea de tiempo ============================== */

const TL_STEM = 56;      // distancia entre la tarjeta y el eje
const TL_DOT_GAP = 110;  // separación mínima entre puntos sobre el eje
const TL_CARD_GAP = 36;  // separación mínima entre tarjetas del mismo lado

let tlGeos = {};      // por timeline: { cx, sides, x0, x1 } del último layout
let tlDragId = null;  // hito en arrastre: el layout no le toca la posición

// Coloca los hitos de cada línea de tiempo sobre su eje horizontal (y = tl.y)
// a partir de tl.x, en el orden del arreglo de nodos, alternando arriba/abajo
// salvo que el hito tenga un lado forzado.
function layoutTimelines() {
  tlGeos = {};
  for (const tl of doc().timelines) {
    const ms = tlMembers(tl.id);
    if (!ms.length) continue;
    const cx = {};
    const sides = {};
    const busyRight = { up: -Infinity, down: -Infinity }; // borde derecho ocupado por lado
    let prev = null;
    ms.forEach((n, i) => {
      const s = sizes[n.id];
      const side = n.side === 'up' || n.side === 'down' ? n.side : (i % 2 ? 'down' : 'up');
      const effW = s.w + (s.note ? s.note.w - NOTE_OVERLAP + 8 : 0);
      let c = prev === null ? tl.x : prev + TL_DOT_GAP;
      c = Math.max(c, busyRight[side] + TL_CARD_GAP + s.w / 2);
      cx[n.id] = c;
      sides[n.id] = side;
      busyRight[side] = c - s.w / 2 + effW;
      prev = c;
      if (n.id !== tlDragId) {
        n.x = Math.round(c - s.w / 2);
        n.y = side === 'up' ? tl.y - TL_STEM - s.h : tl.y + TL_STEM;
      }
    });
    tlGeos[tl.id] = {
      cx, sides,
      x0: cx[ms[0].id] - 46,
      x1: cx[ms[ms.length - 1].id] + 72,
    };
  }
}

// Dibuja un eje con su flecha, el conector de cada hito y su punto de color.
// En el lienzo agrega además una franja invisible para arrastrar el eje entero.
function renderTimelineAxis(tl, parent, opts = {}) {
  const geo = tlGeos[tl.id];
  if (!geo) return;
  const g = el('g', {}, parent);
  const axis = EDGE_COLORS.gray;
  const bg = opts.bg || canvasBg();
  el('line', {
    x1: geo.x0, y1: tl.y, x2: geo.x1, y2: tl.y,
    stroke: axis, 'stroke-width': 2, 'stroke-linecap': 'round',
    'marker-end': 'url(#arrow-gray)',
  }, g);
  for (const n of tlMembers(tl.id)) {
    const s = sizes[n.id];
    const c = geo.cx[n.id];
    const up = geo.sides[n.id] === 'up';
    el('line', {
      x1: n.x + s.w / 2, y1: up ? n.y + s.h : n.y, x2: c, y2: tl.y,
      stroke: axis, 'stroke-width': 1.4,
    }, g);
    const pal = PALETTES[n.color] || PALETTES.slate;
    el('circle', {
      cx: c, cy: tl.y, r: 6, fill: pal.bg, stroke: bg, 'stroke-width': 2.5,
    }, g);
  }
  if (!opts.forExport) {
    const hit = el('line', {
      x1: geo.x0, y1: tl.y, x2: geo.x1 + 14, y2: tl.y,
      stroke: 'transparent', 'stroke-width': 18,
    }, g);
    hit.classList.add('tl-hit');
    hit.dataset.tl = tl.id;
  }
}

/* ============================== render ============================== */

const canvas = $('#canvas');
const worldG = $('#world');
const edgesG = $('#edgesG');
const nodesG = $('#nodesG');
const labelsG = $('#labelsG');
const hoverG = $('#hoverG');
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
    // la etiqueta va en su propia capa, por encima de las tarjetas
    const t = addText(opts.labelParent || g, edge.label, geo.mid[0], geo.mid[1] - 7, {
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
  layoutTimelines();
  computeGroups();
  computeEdgeGeos();
}

/* ---------- grupos: cada componente conexo es "una sola cosa" ---------- */

let groupList = [];       // [{ key, ids: Set, bounds }]
let groupKeyByNode = {};  // nodeId -> key del grupo
let hoverGroupKey = null; // grupo bajo el cursor (o null)

// Une por flechas y por pertenencia a una línea de tiempo. Solo cuentan como
// grupo los componentes con 2+ tarjetas o con un eje (un nodo suelto no).
function computeGroups() {
  const parent = {};
  const find = (a) => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (const n of doc().nodes) parent[n.id] = n.id;
  for (const e of doc().edges) {
    if (parent[e.from] && parent[e.to]) union(e.from, e.to);
  }
  for (const tl of doc().timelines) {
    const ms = tlMembers(tl.id);
    for (let i = 1; i < ms.length; i++) union(ms[0].id, ms[i].id);
  }
  const byRoot = {};
  for (const n of doc().nodes) {
    const r = find(n.id);
    (byRoot[r] = byRoot[r] || []).push(n);
  }
  groupList = [];
  groupKeyByNode = {};
  for (const members of Object.values(byRoot)) {
    if (members.length < 2 && !members[0].tl) continue;
    const ids = new Set(members.map((n) => n.id));
    // clave estable: el menor id del componente
    const key = members.reduce((a, n) => (n.id < a ? n.id : a), members[0].id);
    groupList.push({ key, ids, bounds: contentBounds(ids) });
    for (const id of ids) groupKeyByNode[id] = key;
  }
}

/* ---------- rect de grupo al pasar el cursor, con menú de exportación ---------- */

const GROUP_PAD = 26;

function renderGroupHover() {
  hoverG.innerHTML = '';
  const g = groupList.find((gr) => gr.key === hoverGroupKey);
  if (!g || !g.bounds) {
    hoverGroupKey = null;
    return;
  }
  const x = g.bounds.x - GROUP_PAD;
  const y = g.bounds.y - GROUP_PAD;
  const w = g.bounds.w + GROUP_PAD * 2;
  const h = g.bounds.h + GROUP_PAD * 2;
  el('rect', {
    x, y, width: w, height: h, rx: 14, fill: 'none',
    stroke: isDark() ? 'rgba(233, 233, 228, 0.35)' : 'rgba(43, 43, 40, 0.3)',
    'stroke-width': 1.4, 'stroke-dasharray': '6 5', 'pointer-events': 'none',
  }, hoverG);
  // menú de exportación montado sobre la esquina superior derecha
  const items = [['svg', 'SVG', 42], ['png', 'PNG', 42], ['json', 'JSON', 50], ['md', 'MD', 38]];
  const bh = 22;
  let bx = x + w;
  for (let i = items.length - 1; i >= 0; i--) {
    const [fmt, label, bw] = items[i];
    bx -= bw;
    const btn = el('g', {}, hoverG);
    btn.dataset.groupExport = fmt;
    btn.dataset.group = g.key;
    el('rect', {
      x: bx, y: y - bh / 2, width: bw, height: bh, rx: 7,
      fill: isDark() ? '#26262b' : '#ffffff',
      stroke: isDark() ? '#3a3a41' : '#e3e3de', 'stroke-width': 1,
    }, btn);
    addText(btn, label, bx + bw / 2, y + 4, {
      fill: isDark() ? '#e9e9e4' : '#2b2b28', size: 11.5, weight: 600, anchor: 'middle',
    });
    bx -= 6;
  }
}

// Grupo bajo el cursor: sobre un elemento lo enciende; mientras el cursor
// siga dentro del rect (para alcanzar el menú), se mantiene.
function updateGroupHover(ev) {
  let key = null;
  const nodeG = ev.target.closest ? ev.target.closest('g.node') : null;
  const noteG = ev.target.closest ? ev.target.closest('[data-note-node]') : null;
  if (nodeG) {
    key = groupKeyByNode[nodeG.dataset.id] || null;
  } else if (noteG) {
    key = groupKeyByNode[noteG.dataset.noteNode] || null;
  } else if (ev.target.classList && ev.target.classList.contains('edge-hit')) {
    const e = getEdge(ev.target.dataset.id);
    if (e) key = groupKeyByNode[e.from] || null;
  } else if (ev.target.dataset && ev.target.dataset.editEdge) {
    const e = getEdge(ev.target.dataset.editEdge);
    if (e) key = groupKeyByNode[e.from] || null;
  } else if (ev.target.classList && ev.target.classList.contains('tl-hit')) {
    const first = doc().nodes.find((n) => n.tl === ev.target.dataset.tl);
    if (first) key = groupKeyByNode[first.id] || null;
  } else if (hoverGroupKey) {
    const g = groupList.find((gr) => gr.key === hoverGroupKey);
    if (g && g.bounds) {
      const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
      const b = g.bounds;
      if (wx >= b.x - GROUP_PAD && wx <= b.x + b.w + GROUP_PAD &&
          wy >= b.y - GROUP_PAD - 16 && wy <= b.y + b.h + GROUP_PAD) {
        key = hoverGroupKey;
      }
    }
  }
  if (key !== hoverGroupKey) {
    hoverGroupKey = key;
    renderGroupHover();
  }
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
  labelsG.innerHTML = '';
  for (const e of doc().edges) {
    const g = renderEdge(e, { labelParent: labelsG });
    if (g) edgesG.appendChild(g);
  }
  for (const tl of doc().timelines) renderTimelineAxis(tl, edgesG);
  nodesG.innerHTML = '';
  for (const n of doc().nodes) nodesG.appendChild(renderNode(n));
  renderGroupHover();
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
  labelsG.innerHTML = '';
  for (const e of doc().edges) {
    const g = renderEdge(e, { labelParent: labelsG });
    if (g) edgesG.appendChild(g);
  }
  for (const tl of doc().timelines) renderTimelineAxis(tl, edgesG);
  nodesG.innerHTML = '';
  for (const n of doc().nodes) nodesG.appendChild(renderNode(n));
  renderGroupHover();
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
  }
  const allTl = ns.length > 0 && ns.every((m) => m.tl);
  if (multi) {
    $('#pMultiCount').textContent = ns.length + ' nodos seleccionados';
    // a los hitos los coloca el layout: alinear/distribuir no les aplica
    $('#pAlignField').hidden = allTl;
    $('#pDistField').hidden = allTl;
    for (const b of document.querySelectorAll('#pDistribute button')) {
      b.disabled = ns.length < 3;
    }
  }
  $('#pSideField').hidden = !allTl;
  $('#pSideFieldMulti').hidden = !allTl;
  const sideUniform = allTl &&
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
  if (n.tl) {
    // un hito duplicado queda justo después del original en su secuencia
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
    // un eje sin hitos desaparece con ellos
    doc().timelines = doc().timelines.filter((t) => doc().nodes.some((n) => n.tl === t.id));
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
  const deletedId = store.current;
  delete store.docs[store.current];
  cloud.deleteDoc(deletedId);
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

/* ============================== UI de cuentas ============================== */

let authMode = 'login';

function updateAuthUI() {
  const btn = $('#authBtn');
  if (!btn) return;
  if (cloud.user) {
    const label = cloud.user.name && cloud.user.name !== cloud.user.email
      ? cloud.user.name
      : cloud.user.email;
    btn.textContent = label;
    btn.classList.add('signed-in');
    btn.title = 'Cuenta: ' + cloud.user.email;
    const em = $('#accountEmail');
    if (em) em.textContent = cloud.user.email;
    hideSessionExpired(); // si veníamos de un aviso de expiración, ya entró
  } else {
    btn.textContent = 'Iniciar sesión';
    btn.classList.remove('signed-in');
    btn.title = 'Iniciar sesión (opcional)';
    $('#accountMenu').hidden = true;
  }
}

function showSessionExpired() { $('#sessionToast').hidden = false; }
function hideSessionExpired() { $('#sessionToast').hidden = true; }

function openAuthModal() {
  setAuthMode('login');
  $('#authError').hidden = true;
  $('#authForm').reset();
  $('#authModal').hidden = false;
  $('#authEmail').focus();
}
function closeAuthModal() { $('#authModal').hidden = true; }

function setAuthMode(m) {
  authMode = m;
  for (const tab of document.querySelectorAll('.auth-tab')) {
    tab.classList.toggle('active', tab.dataset.mode === m);
  }
  $('#authNameField').hidden = m !== 'register';
  $('#authSubmit').textContent = m === 'register' ? 'Crear cuenta' : 'Entrar';
  $('#authPassword').setAttribute('autocomplete', m === 'register' ? 'new-password' : 'current-password');
  $('#authError').hidden = true;
}

$('#authBtn').addEventListener('click', () => {
  if (cloud.user) {
    $('#accountMenu').hidden = !$('#accountMenu').hidden;
  } else {
    openAuthModal();
  }
});

$('#authClose').addEventListener('click', closeAuthModal);
$('#authModal').addEventListener('click', (ev) => {
  if (ev.target === $('#authModal')) closeAuthModal();
});

for (const tab of document.querySelectorAll('.auth-tab')) {
  tab.addEventListener('click', () => setAuthMode(tab.dataset.mode));
}

$('#authForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const name = $('#authName').value.trim();
  const email = $('#authEmail').value.trim();
  const password = $('#authPassword').value;
  const err = $('#authError');
  const submit = $('#authSubmit');
  err.hidden = true;
  submit.disabled = true;
  const prev = submit.textContent;
  submit.textContent = '…';
  try {
    if (authMode === 'register') await cloud.register(name, email, password);
    else await cloud.login(email, password);
    closeAuthModal();
  } catch (e) {
    err.textContent = e.message || 'Error';
    err.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = prev;
  }
});

$('#logoutBtn').addEventListener('click', () => {
  cloud.logout();
  $('#accountMenu').hidden = true;
});

$('#sessionToastLogin').addEventListener('click', () => {
  hideSessionExpired();
  openAuthModal();
});
$('#sessionToastClose').addEventListener('click', hideSessionExpired);

// Cerrar el menú de cuenta al hacer clic fuera.
document.addEventListener('click', (ev) => {
  const menu = $('#accountMenu');
  if (menu.hidden) return;
  if (!menu.contains(ev.target) && ev.target !== $('#authBtn')) menu.hidden = true;
});

/* ============================== interacción ============================== */

let mode = null; // pan | drag | connect | pinch
// punteros activos por id (para pinch-to-zoom y desplazamiento con dos dedos)
const pointers = new Map();
let gesturePointerId = null; // dedo que dirige el gesto de un solo puntero

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
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  // dos dedos: entrar en pinch (zoom + desplazamiento) si no hay otro gesto en curso
  if (pointers.size >= 2) {
    if (!mode || mode.type === 'pan' || mode.type === 'pinch') {
      const [a, b] = [...pointers.values()];
      mode = {
        type: 'pinch',
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2,
        z0: view().z, vx0: view().x, vy0: view().y,
      };
      canvas.classList.remove('panning', 'connecting');
      draftG.innerHTML = '';
      guides = { x: null, y: null };
    }
    return;
  }
  gesturePointerId = ev.pointerId; // este dedo dirige el gesto de un puntero
  const portEl = ev.target.closest && ev.target.classList.contains('port') ? ev.target : null;
  const nodeG = ev.target.closest ? ev.target.closest('g.node') : null;
  let edgeId = null;
  if (ev.target.classList && ev.target.classList.contains('edge-hit')) {
    edgeId = ev.target.dataset.id;
  } else if (ev.target.dataset && ev.target.dataset.editEdge) {
    edgeId = ev.target.dataset.editEdge; // clic sobre la etiqueta de la flecha
  }

  // menú del grupo: exportar el componente bajo el cursor
  const gBtn = ev.target.closest ? ev.target.closest('[data-group-export]') : null;
  if (gBtn && ev.button === 0) {
    exportGroup(gBtn.dataset.groupExport, gBtn.dataset.group);
    return;
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
    if (n.tl) {
      // un hito se arrastra solo: reordena dentro de su línea de tiempo
      if (!inSel || selection.ids.length > 1) {
        selection = { type: 'node', ids: [n.id] };
        renderAll();
      }
      const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
      tlDragId = n.id;
      mode = { type: 'dragT', id: n.id, tl: n.tl, offX: wx - n.x, offY: wy - n.y, moved: false };
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
  // arrastrar un eje mueve la línea de tiempo completa
  if (ev.target.classList && ev.target.classList.contains('tl-hit') && ev.button === 0) {
    const tl = getTl(ev.target.dataset.tl);
    if (tl) {
      const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
      mode = { type: 'dragAxis', id: tl.id, ox: tl.x, oy: tl.y, wx, wy, moved: false };
      return;
    }
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
  if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (mode && mode.type === 'pinch') {
    if (pointers.size < 2) return;
    const [a, b] = [...pointers.values()];
    const rect = canvas.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const z2 = clamp(mode.z0 * (d / mode.d0), 0.2, 3);
    const mcx = (a.x + b.x) / 2, mcy = (a.y + b.y) / 2;
    // ancla: el punto del mundo bajo el centro inicial sigue al centro actual
    const wx = (mode.cx - rect.left - mode.vx0) / mode.z0;
    const wy = (mode.cy - rect.top - mode.vy0) / mode.z0;
    const v = view();
    v.z = z2;
    v.x = (mcx - rect.left) - wx * z2;
    v.y = (mcy - rect.top) - wy * z2;
    applyViewTransform();
    saveStore();
    return;
  }
  // en gestos de un puntero, solo el dedo que los inició los mueve
  if (mode && ev.pointerId !== gesturePointerId) return;
  if (!mode) {
    updateGroupHover(ev);
    return;
  }
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
  if (mode.type === 'dragAxis') {
    const tl = getTl(mode.id);
    if (!tl) return;
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    const nx = Math.round(mode.ox + wx - mode.wx);
    const ny = Math.round(mode.oy + wy - mode.wy);
    if (nx !== tl.x || ny !== tl.y) mode.moved = true;
    tl.x = nx;
    tl.y = ny;
    renderCanvasOnly();
    return;
  }
  if (mode.type === 'dragT') {
    const n = getNode(mode.id);
    const tl = getTl(mode.tl);
    const geo = tlGeos[mode.tl];
    if (!n || !tl || !geo) return;
    const [wx, wy] = screenToWorld(ev.clientX, ev.clientY);
    const nx = Math.round(wx - mode.offX);
    const ny = Math.round(wy - mode.offY);
    if (nx !== n.x || ny !== n.y) mode.moved = true;
    n.x = nx;
    n.y = ny;
    // el lado se elige arrastrando: donde sueltes la tarjeta, ahí se queda
    if (mode.moved) n.side = ny + sizes[n.id].h / 2 < tl.y ? 'up' : 'down';
    // posición destino según el centro del hito frente a los puntos del resto
    const ns = doc().nodes;
    const center = n.x + sizes[n.id].w / 2;
    const others = tlMembers(mode.tl).filter((m) => m.id !== n.id);
    let idx = others.length;
    for (let i = 0; i < others.length; i++) {
      if (center < geo.cx[others[i].id]) { idx = i; break; }
    }
    const curPos = others.filter((m) => ns.indexOf(m) < ns.indexOf(n)).length;
    if (idx !== curPos && others.length) {
      ns.splice(ns.indexOf(n), 1);
      const at = idx >= others.length
        ? ns.indexOf(others[others.length - 1]) + 1
        : ns.indexOf(others[idx]);
      ns.splice(at, 0, n);
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
  pointers.delete(ev.pointerId);
  if (mode && mode.type === 'pinch') {
    // al levantar un dedo, el que queda retoma el desplazamiento
    if (pointers.size === 1) {
      const [id] = [...pointers.keys()];
      const p = pointers.get(id);
      gesturePointerId = id;
      mode = { type: 'pan', startX: p.x, startY: p.y, ox: view().x, oy: view().y };
    } else {
      mode = null;
    }
    return;
  }
  // solo el dedo que inició el gesto lo completa (ignora toques secundarios)
  if (ev.pointerId !== gesturePointerId) return;
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
  if (mode.type === 'dragAxis' && mode.moved) commit();
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

canvas.addEventListener('pointerleave', () => {
  if (hoverGroupKey) {
    hoverGroupKey = null;
    renderGroupHover();
  }
});

canvas.addEventListener('pointercancel', (ev) => {
  pointers.delete(ev.pointerId);
  if (mode && mode.type === 'pinch' && pointers.size < 2) mode = null;
  canvas.classList.remove('panning', 'connecting');
});

canvas.addEventListener('dblclick', (ev) => {
  if (ev.target.closest && ev.target.closest('[data-group-export]')) return;
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
  // doble clic sobre un eje: insertar un hito en ese punto de la secuencia
  if (ev.target.classList && ev.target.classList.contains('tl-hit')) {
    addMilestoneAt(ev.target.dataset.tl, wx);
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
    delete copy.tl; // los hitos copiados se pegan como nodos libres
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
    if (ns.every((m) => m.tl)) {
      // hitos: ←/→ mueven en su secuencia; ↑/↓ fuerzan su lado del eje
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
      if (n.tl) continue; // a los hitos los coloca el layout
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

// Inserta un hito en la línea de tiempo dada, en el punto que corresponde a wx.
function addMilestoneAt(tlId, wx) {
  const geo = tlGeos[tlId];
  if (!geo) return;
  const n = {
    id: uid(), x: 0, y: 0, tl: tlId,
    title: 'Nuevo hito', subtitle: 'descripción', color: 'slate', rows: [],
  };
  const ns = doc().nodes;
  const members = tlMembers(tlId);
  const after = members.find((m) => wx < geo.cx[m.id]);
  ns.splice(after ? ns.indexOf(after) : ns.length, 0, n);
  selection = { type: 'node', ids: [n.id] };
  panelFor = null;
  commit();
  renderAll();
  $('#pTitle').focus();
  $('#pTitle').select();
}

// Mueve un hito una posición antes o después dentro de su línea de tiempo.
function moveMilestone(n, delta) {
  const ns = doc().nodes;
  const members = tlMembers(n.tl);
  const i = members.indexOf(n);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= members.length) return;
  const other = members[j];
  ns.splice(ns.indexOf(n), 1);
  ns.splice(ns.indexOf(other) + (delta > 0 ? 1 : 0), 0, n);
  commit();
  renderAll();
}

// Crea una línea de tiempo nueva con hitos de ejemplo, con el eje en (x, y).
function addTimelineAt(x, y) {
  const tl = { id: uid(), x: Math.round(x), y: Math.round(y) };
  doc().timelines.push(tl);
  const mk = (title, subtitle, color) =>
    doc().nodes.push({ id: uid(), x: 0, y: 0, tl: tl.id, title, subtitle, color, rows: [] });
  mk('Antes', 'cómo era', 'slate');
  mk('El cambio', 'qué pasó', 'indigo');
  mk('Después', 'cómo quedó', 'teal');
  selection = null;
  commit();
  renderAll();
}

$('#addNode').addEventListener('click', () => {
  const rect = canvas.getBoundingClientRect();
  const [wx, wy] = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  addNodeAt(wx - 95 + Math.random() * 40 - 20, wy - 27 + Math.random() * 40 - 20);
});

$('#addTimeline').addEventListener('click', () => {
  const rect = canvas.getBoundingClientRect();
  const [wx, wy] = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  addTimelineAt(wx - 260, wy);
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

// Límites del contenido; con `ids` se limita a esos nodos (y a los ejes de
// las líneas de tiempo que tengan algún hito incluido).
function contentBounds(ids) {
  const ns = doc().nodes.filter((n) => !ids || ids.has(n.id));
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
  for (const tl of doc().timelines) {
    const geo = tlGeos[tl.id];
    if (!geo) continue;
    if (ids && !ns.some((n) => n.tl === tl.id)) continue;
    x0 = Math.min(x0, geo.x0);
    x1 = Math.max(x1, geo.x1 + 14); // punta de flecha del eje
    y0 = Math.min(y0, tl.y - 10);
    y1 = Math.max(y1, tl.y + 10);
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
// Los hitos no participan: a ellos los coloca su línea de tiempo.
function autoLayout() {
  const ns = doc().nodes.filter((n) => !n.tl);
  if (ns.length < 2 || animating) return;
  computeSizes();
  const free = new Set(ns.map((n) => n.id));
  const E = doc().edges.filter((e) =>
    e.from !== e.to && free.has(e.from) && free.has(e.to));

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
  const succs = {};
  for (const e of E) {
    (preds[e.to] = preds[e.to] || []).push(e.from);
    (succs[e.from] = succs[e.from] || []).push(e.to);
  }

  const HGAP = 60;
  const VGAP = 90;
  const oldB = contentBounds(free); // re-centrar solo respecto al diagrama libre

  // varias pasadas de baricentro — bajando se mira a los padres, subiendo a
  // los hijos — para reducir cruces y centrar cada rama sobre la suya
  const centers = {};
  for (const n of ns) centers[n.id] = n.x + sizes[n.id].w / 2;
  const packRow = (row, desired) => {
    row.sort((a, b) => desired.get(a.id) - desired.get(b.id) || a.x - b.x);
    // colocación codiciosa sin encimar y corrimiento del sesgo medio
    let x = -Infinity;
    const pos = new Map();
    for (const n of row) {
      x = Math.max(desired.get(n.id) - sizes[n.id].w / 2, x);
      pos.set(n.id, x);
      x += sizes[n.id].w + HGAP;
    }
    let bias = 0;
    for (const n of row) bias += pos.get(n.id) + sizes[n.id].w / 2 - desired.get(n.id);
    bias /= row.length;
    for (const n of row) centers[n.id] = pos.get(n.id) - bias + sizes[n.id].w / 2;
  };
  for (let it = 0; it < 4; it++) {
    const down = it % 2 === 0;
    const nb = down ? preds : succs;
    for (const row of down ? rows : [...rows].reverse()) {
      const desired = new Map();
      for (const n of row) {
        const vs = (nb[n.id] || []).map((id) => centers[id]);
        desired.set(n.id, vs.length
          ? vs.reduce((a, b) => a + b, 0) / vs.length
          : centers[n.id]);
      }
      packRow(row, desired);
    }
  }

  const targets = {};
  let y = 0;
  for (const row of rows) {
    let maxH = 0;
    for (const n of row) {
      targets[n.id] = [Math.round(centers[n.id] - sizes[n.id].w / 2), Math.round(y)];
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
    { app: 'diagramb', name: d.name, nodes: d.nodes, edges: d.edges, timelines: d.timelines }
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
    const d = newDoc(p.name || 'Compartido');
    d.nodes = p.nodes;
    d.edges = p.edges;
    d.timelines = p.timelines || [];
    d.type = p.type;
    normalizeDoc(d);
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

// Exporta todo el canvas, o solo los nodos de `onlyIds` (más las flechas
// internas y las líneas de tiempo completas de los hitos incluidos).
function buildExportSvg(onlyIds) {
  computeSizes();
  let ids = null;
  if (onlyIds && onlyIds.size) {
    ids = new Set(onlyIds);
    // un hito arrastra a toda su línea de tiempo: un eje a medias no se entiende
    const tls = new Set();
    for (const n of doc().nodes) if (ids.has(n.id) && n.tl) tls.add(n.tl);
    for (const n of doc().nodes) if (n.tl && tls.has(n.tl)) ids.add(n.id);
  }
  const b = contentBounds(ids);
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
  const labelLayer = el('g', {});
  for (const e of doc().edges) {
    if (ids && !(ids.has(e.from) && ids.has(e.to))) continue;
    const g = renderEdge(e, { forExport: true, bg, labelParent: labelLayer });
    if (g) svg.appendChild(g);
  }
  for (const tl of doc().timelines) {
    if (ids && !doc().nodes.some((n) => n.tl === tl.id && ids.has(n.id))) continue;
    renderTimelineAxis(tl, svg, { bg, forExport: true });
  }
  for (const n of doc().nodes) {
    if (ids && !ids.has(n.id)) continue;
    svg.appendChild(renderNode(n, { forExport: true }));
  }
  svg.appendChild(labelLayer); // etiquetas encima de las tarjetas
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

// Con nodos seleccionados se exporta solo esa parte del canvas.
const exportSelectionIds = () =>
  selection && selection.type === 'node' && selection.ids.length
    ? new Set(selection.ids) : null;

function downloadSvgExport(ids) {
  const out = buildExportSvg(ids);
  if (!out) { alert('El diagrama está vacío.'); return; }
  const str = new XMLSerializer().serializeToString(out.svg);
  downloadBlob(new Blob([str], { type: 'image/svg+xml' }), fileSlug() + '.svg');
}

function downloadPngExport(ids) {
  const out = buildExportSvg(ids);
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
}

// JSON de una parte del canvas (o de todo, con ids = null), importable después.
function downloadJsonExport(ids) {
  const d = doc();
  const nodes = d.nodes.filter((n) => !ids || ids.has(n.id));
  const inc = new Set(nodes.map((n) => n.id));
  const edges = d.edges.filter((e) => inc.has(e.from) && inc.has(e.to));
  const timelines = d.timelines.filter((t) => nodes.some((n) => n.tl === t.id));
  const data = JSON.stringify(
    { app: 'diagramb', name: d.name, nodes, edges, timelines }, null, 2
  );
  downloadBlob(new Blob([data], { type: 'application/json' }), fileSlug() + '.json');
}

// Markdown legible pensado para pegar como contexto en una IA: nodos con su
// tabla y nota, las líneas de tiempo en orden y la lista de conexiones.
function downloadMdExport(ids) {
  const d = doc();
  const nodes = d.nodes.filter((n) => !ids || ids.has(n.id));
  if (!nodes.length) { alert('El diagrama está vacío.'); return; }
  const inc = new Set(nodes.map((n) => n.id));
  const edges = d.edges.filter((e) => inc.has(e.from) && inc.has(e.to));
  const timelines = d.timelines.filter((t) => nodes.some((n) => n.tl === t.id));

  const oneLine = (s) => String(s == null ? '' : s).replace(/\s*\n\s*/g, ' ').trim();
  const cell = (s) => oneLine(s).replace(/\|/g, '\\|');
  const titleOf = (id) => {
    const n = nodes.find((x) => x.id === id);
    return oneLine(n ? n.title : '') || 'sin título';
  };

  // Las celdas ya pueden traer markdown (**negrita**, `código`): se respeta.
  const renderTable = (rows, indent) => {
    let s = '';
    const [head, ...rest] = rows;
    s += `${indent}| ${cell(head[0])} | ${cell(head[1])} |\n`;
    s += `${indent}| --- | --- |\n`;
    for (const r of rest) s += `${indent}| ${cell(r[0])} | ${cell(r[1])} |\n`;
    return s;
  };

  let md = `# ${oneLine(d.name) || 'Diagrama'}\n\n`;

  const freeNodes = nodes.filter((n) => !n.tl);
  if (freeNodes.length) {
    md += '## Nodos\n\n';
    for (const n of freeNodes) {
      md += `### ${oneLine(n.title) || 'Sin título'}\n\n`;
      if (n.subtitle) md += `*${oneLine(n.subtitle)}*\n\n`;
      if (n.rows && n.rows.length) md += renderTable(n.rows, '') + '\n';
      if (n.note) md += `> ${oneLine(n.note)}\n\n`;
    }
  }

  timelines.forEach((tl, ti) => {
    const members = nodes.filter((n) => n.tl === tl.id); // orden = orden en el eje
    if (!members.length) return;
    md += timelines.length > 1 ? `## Línea de tiempo ${ti + 1}\n\n` : '## Línea de tiempo\n\n';
    members.forEach((n, i) => {
      md += `${i + 1}. **${oneLine(n.title) || 'Sin título'}**`;
      if (n.subtitle) md += ` — ${oneLine(n.subtitle)}`;
      md += '\n';
      if (n.note) md += `   > ${oneLine(n.note)}\n`;
      if (n.rows && n.rows.length) {
        for (const r of n.rows) md += `   - ${oneLine(r[0])}: ${oneLine(r[1])}\n`;
      }
    });
    md += '\n';
  });

  if (edges.length) {
    md += '## Conexiones\n\n';
    for (const e of edges) {
      const arrow = e.both ? '↔' : '→';
      let line = `- **${titleOf(e.from)}** ${arrow} **${titleOf(e.to)}**`;
      const extra = [];
      if (e.label) extra.push(oneLine(e.label));
      if (e.dashed) extra.push('punteada');
      if (extra.length) line += `: ${extra.join(' · ')}`;
      md += line + '\n';
    }
    md += '\n';
  }

  downloadBlob(new Blob([md], { type: 'text/markdown' }), fileSlug() + '.md');
}

// Exportación desde el menú del rect de grupo.
function exportGroup(fmt, key) {
  const g = groupList.find((gr) => gr.key === key);
  if (!g) return;
  if (fmt === 'svg') downloadSvgExport(g.ids);
  else if (fmt === 'png') downloadPngExport(g.ids);
  else if (fmt === 'json') downloadJsonExport(g.ids);
  else if (fmt === 'md') downloadMdExport(g.ids);
}

$('#exportSvg').addEventListener('click', () => downloadSvgExport(exportSelectionIds()));
$('#exportPng').addEventListener('click', () => downloadPngExport(exportSelectionIds()));
$('#exportJson').addEventListener('click', () => downloadJsonExport(null));
$('#exportMd').addEventListener('click', () => downloadMdExport(exportSelectionIds()));

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
      d.timelines = p.timelines || [];
      d.type = p.type;
      normalizeDoc(d);
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
cloud.init();
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
