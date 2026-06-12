// Prueba de humo: simula interacciones reales y vuelca los resultados en #smokeResult.
window.addEventListener('load', () => setTimeout(runSmoke, 50));

function runSmoke() {
  const out = [];
  const ok = (name, cond) => out.push((cond ? 'PASS' : 'FAIL') + ' ' + name);
  const api = window.__diagramb;
  const canvas = document.getElementById('canvas');

  const pe = (type, target, x, y, extra = {}) =>
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, clientX: x, clientY: y,
      button: 0, pointerId: 1, ...extra,
    }));

  const toClient = (wx, wy) => {
    const r = canvas.getBoundingClientRect();
    const v = api.doc.view;
    return [r.left + v.x + wx * v.z, r.top + v.y + wy * v.z];
  };

  try {
    const d = api.doc;
    ok('carga inicial con nodos', d.nodes.length >= 5);
    ok('carga inicial con flechas', d.edges.length >= 5);

    // --- arrastrar un nodo ---
    const n = d.nodes[0];
    const x0 = n.x, y0 = n.y;
    const g = document.querySelector(`g.node[data-id="${n.id}"] rect`);
    let [cx, cy] = toClient(x0 + 30, y0 + 20);
    pe('pointerdown', g, cx, cy);
    pe('pointermove', canvas, cx + 80, cy + 60);
    pe('pointerup', canvas, cx + 80, cy + 60);
    ok('arrastrar nodo lo mueve', Math.abs(n.x - (x0 + 80)) < 10 && Math.abs(n.y - (y0 + 60)) < 10);
    ok('arrastrar selecciona el nodo', api.selection && api.selection.id === n.id);

    // --- deshacer el arrastre ---
    api.undo();
    const n2 = api.doc.nodes.find((m) => m.id === n.id);
    ok('deshacer restaura posición', n2.x === x0 && n2.y === y0);
    api.redo();
    const n3 = api.doc.nodes.find((m) => m.id === n.id);
    ok('rehacer reaplica posición', n3.x !== x0 || n3.y !== y0);

    // --- conectar dos nodos desde un puerto ---
    const a = api.doc.nodes[0];
    const b = api.doc.nodes[api.doc.nodes.length - 1];
    const edgesBefore = api.doc.edges.length;
    const port = document.querySelector(`g.node[data-id="${a.id}"] .port[data-side="right"]`);
    const pcx = toClient(a.x + 100, a.y + 10);
    pe('pointerdown', port, pcx[0], pcx[1]);
    const [bx, by] = toClient(b.x + 20, b.y + 20);
    pe('pointermove', canvas, bx, by);
    pe('pointerup', canvas, bx, by);
    const created = api.doc.edges.length === edgesBefore + 1;
    ok('arrastre desde puerto crea flecha', created);
    if (created) {
      const e = api.doc.edges[api.doc.edges.length - 1];
      ok('la flecha conecta los nodos correctos', e.from === a.id && e.to === b.id);
    }

    // --- borrar con teclado ---
    const nodesBefore = api.doc.nodes.length;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    ok('Backspace borra la selección (flecha)', api.doc.edges.length === edgesBefore && api.doc.nodes.length === nodesBefore);

    // --- exportación ---
    const exp = api.buildExportSvg();
    ok('export genera SVG', !!exp && exp.w > 100 && exp.h > 100);
    ok('export contiene los nodos', exp.svg.querySelectorAll('rect').length > api.doc.nodes.length);
    ok('export contiene las flechas', exp.svg.querySelectorAll('path').length >= api.doc.edges.length);
    const str = new XMLSerializer().serializeToString(exp.svg);
    ok('SVG serializa con xmlns', str.startsWith('<svg') && str.includes('http://www.w3.org/2000/svg'));

    // --- persistencia ---
    setTimeout(() => {
      const saved = JSON.parse(localStorage.getItem('diagramb.v1'));
      const cur = saved && saved.docs[saved.current];
      ok('localStorage guarda el diagrama', !!cur && cur.nodes.length === api.doc.nodes.length);
      report(out);
    }, 400);
  } catch (err) {
    out.push('ERROR ' + err.message);
    report(out);
  }
}

function report(out) {
  const pre = document.createElement('pre');
  pre.id = 'smokeResult';
  pre.textContent = out.join('\n');
  document.body.appendChild(pre);
}
