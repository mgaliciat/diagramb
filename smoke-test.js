// Prueba de humo: simula interacciones reales y vuelca los resultados en #smokeResult.
// El portapapeles del sistema se sustituye por un stub: en headless el prompt de
// permiso congela la página, y así además se prueba la ruta de respaldo en memoria.
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: () => Promise.resolve(),
    readText: () => Promise.reject(new Error('stub')),
  },
});

window.addEventListener('load', () => setTimeout(runSmoke, 50));

async function runSmoke() {
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
    ok('arrastrar selecciona el nodo', api.selection && api.selection.ids.includes(n.id));

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

    // --- popup de tipo de flecha ---
    ok('popup de tipo de flecha aparece', !document.getElementById('edgePopup').hidden);
    const dashedBtn = [...document.querySelectorAll('#popupEdgeControls .seg button')]
      .find((btn) => btn.textContent.includes('– – –'));
    dashedBtn.click();
    ok('popup aplica estilo punteado', api.doc.edges[api.doc.edges.length - 1].dashed === true);
    document.getElementById('popupDone').click();
    ok('popup se cierra con Listo', document.getElementById('edgePopup').hidden);

    // --- borrar con teclado ---
    const nodesBefore = api.doc.nodes.length;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
    ok('Backspace borra la selección (flecha)', api.doc.edges.length === edgesBefore && api.doc.nodes.length === nodesBefore);

    // --- selección múltiple con marquee (shift+arrastre en el fondo) ---
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const m of api.doc.nodes) {
      minX = Math.min(minX, m.x); minY = Math.min(minY, m.y);
      maxX = Math.max(maxX, m.x + 200); maxY = Math.max(maxY, m.y + 80);
    }
    const [m0x, m0y] = toClient(minX - 20, minY - 20);
    const [m1x, m1y] = toClient(maxX + 20, maxY + 20);
    pe('pointerdown', canvas, m0x, m0y, { shiftKey: true });
    pe('pointermove', canvas, m1x, m1y, { shiftKey: true });
    pe('pointerup', canvas, m1x, m1y, { shiftKey: true });
    const all = api.doc.nodes.length;
    ok('marquee selecciona todos los nodos',
      api.selection && api.selection.type === 'node' && api.selection.ids.length === all);
    ok('panel múltiple visible', !document.getElementById('panelMulti').hidden);

    // --- arrastre en grupo ---
    const p1 = api.doc.nodes[0], p2 = api.doc.nodes[1];
    const g1 = { x: p1.x, y: p1.y }, g2 = { x: p2.x, y: p2.y };
    const rect1 = document.querySelector(`g.node[data-id="${p1.id}"] rect`);
    const [d0x, d0y] = toClient(p1.x + 30, p1.y + 20);
    pe('pointerdown', rect1, d0x, d0y);
    pe('pointermove', canvas, d0x + 100, d0y);
    pe('pointerup', canvas, d0x + 100, d0y);
    ok('arrastre en grupo mueve todos',
      Math.abs(p1.x - (g1.x + 100)) < 10 && Math.abs(p2.x - (g2.x + 100)) < 10 && p2.y === g2.y);

    // --- clic simple colapsa la selección múltiple ---
    const rect1b = document.querySelector(`g.node[data-id="${p1.id}"] rect`);
    const [c1x, c1y] = toClient(p1.x + 30, p1.y + 20);
    pe('pointerdown', rect1b, c1x, c1y);
    pe('pointerup', canvas, c1x, c1y);
    ok('clic colapsa selección múltiple a un nodo',
      api.selection && api.selection.type === 'node' && api.selection.ids.length === 1);

    // --- copiar / pegar ---
    const beforePaste = api.doc.nodes.length;
    api.copySelection();
    await api.pasteClipboard();
    ok('pegar agrega una copia', api.doc.nodes.length === beforePaste + 1);
    const pasted = api.doc.nodes[api.doc.nodes.length - 1];
    ok('la copia conserva el contenido',
      pasted.title === p1.title && pasted.id !== p1.id && pasted.x === p1.x + 24);

    // --- edición inline ---
    const titleEl = document.querySelector(`g.node[data-id="${pasted.id}"] text[data-edit-field="title"]`);
    titleEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    const inline = document.querySelector('.inline-edit');
    ok('doble clic abre editor inline', !!inline);
    if (inline) {
      inline.value = 'editado inline';
      inline.dispatchEvent(new Event('input', { bubbles: true }));
      inline.dispatchEvent(new FocusEvent('blur'));
      ok('editor inline guarda el texto', pasted.title === 'editado inline');
    }

    // --- etiqueta de flecha inline ---
    const lblEl = document.querySelector('text[data-edit-edge]');
    if (lblEl) {
      const edgeId = lblEl.dataset.editEdge;
      lblEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
      const ein = document.querySelector('.inline-edit');
      ok('doble clic en etiqueta de flecha abre editor', !!ein);
      if (ein) {
        ein.value = 'etiqueta editada';
        ein.dispatchEvent(new Event('input', { bubbles: true }));
        ein.dispatchEvent(new FocusEvent('blur'));
        const edge = api.doc.edges.find((x) => x.id === edgeId);
        ok('editor inline guarda la etiqueta', edge && edge.label === 'etiqueta editada');
      }
    } else {
      ok('hay etiquetas de flecha para editar', false);
    }

    // --- modo oscuro ---
    document.getElementById('themeToggle').click();
    ok('modo oscuro activa', document.body.classList.contains('dark'));
    document.getElementById('themeToggle').click();
    ok('modo claro restaurado', !document.body.classList.contains('dark'));

    // --- compartir: compresión ida y vuelta ---
    const enc = await api.deflateB64('diagramb ✓ áéí');
    const dec = await api.inflateFromB64(enc);
    ok('compartir codifica y decodifica', dec === 'diagramb ✓ áéí');

    // --- alinear y distribuir ---
    let nx0 = Infinity, ny0 = Infinity, nx1 = -Infinity, ny1 = -Infinity;
    for (const m of api.doc.nodes) {
      nx0 = Math.min(nx0, m.x); ny0 = Math.min(ny0, m.y);
      nx1 = Math.max(nx1, m.x + 300); ny1 = Math.max(ny1, m.y + 100);
    }
    const [q0x, q0y] = toClient(nx0 - 20, ny0 - 20);
    const [q1x, q1y] = toClient(nx1 + 20, ny1 + 20);
    pe('pointerdown', canvas, q0x, q0y, { shiftKey: true });
    pe('pointermove', canvas, q1x, q1y, { shiftKey: true });
    pe('pointerup', canvas, q1x, q1y, { shiftKey: true });
    document.querySelector('#pAlign button[data-k="left"]').click();
    const selNodes = api.selection.ids.map((id) => api.doc.nodes.find((m) => m.id === id));
    ok('alinear izquierda iguala x', selNodes.every((m) => m.x === selNodes[0].x));
    document.querySelector('#pDistribute button[data-k="v"]').click();
    const byY = [...selNodes].sort((m1, m2) => m1.y - m2.y);
    const gaps = [];
    for (let i = 1; i < byY.length; i++) {
      gaps.push(byY[i].y - (byY[i - 1].y + api.sizes[byY[i - 1].id].h));
    }
    ok('distribuir verticalmente empareja huecos',
      gaps.every((gp) => Math.abs(gp - gaps[0]) <= 1.5));

    // --- markdown en celdas ---
    const tableNode = api.doc.nodes.find((nn) => nn.rows && nn.rows.length);
    if (tableNode) {
      tableNode.rows[0][1] = 'usa **fuerte** y `cod`';
      api.renderAll();
      const sel = `g.node[data-id="${tableNode.id}"]`;
      const boldSpan = document.querySelector(`${sel} text tspan[font-weight="700"]`);
      ok('markdown: **negrita** renderiza en bold', !!boldSpan && boldSpan.textContent === 'fuerte');
      ok('markdown: `código` tiene fondo', !!document.querySelector(`${sel} rect[rx="4"]`));
      const cellText = [...document.querySelectorAll(`${sel} text`)]
        .map((t) => t.textContent).join(' ');
      ok('markdown: los marcadores no se muestran', !cellText.includes('**') && !cellText.includes('`'));
    } else {
      ok('hay nodo con tabla para markdown', false);
    }

    // --- nota flotante ---
    const noteHost = api.doc.nodes[0];
    noteHost.note = 'una nota de prueba que envuelve en varias líneas para verificar el ancho';
    api.renderAll();
    const noteEl = document.querySelector(`[data-note-node="${noteHost.id}"]`);
    ok('la nota se renderiza junto a la tarjeta', !!noteEl);
    ok('la nota envuelve el texto en líneas', noteEl && noteEl.querySelectorAll('text').length >= 2);
    const portsOfHost = document.querySelectorAll(`g.node[data-id="${noteHost.id}"] .port`).length;
    ok('la nota no agrega puertos', portsOfHost === 4);
    const expNote = api.buildExportSvg();
    const expStr = new XMLSerializer().serializeToString(expNote.svg);
    ok('la nota sale en la exportación', expStr.includes('#fbedb0'));
    noteHost.note = '';
    api.renderAll();
    ok('nota vacía no se renderiza', !document.querySelector(`[data-note-node="${noteHost.id}"]`));

    // --- exportación ---
    const exp = api.buildExportSvg();
    ok('export genera SVG', !!exp && exp.w > 100 && exp.h > 100);
    ok('export contiene los nodos', exp.svg.querySelectorAll('rect').length > api.doc.nodes.length);
    ok('export contiene las flechas', exp.svg.querySelectorAll('path').length >= api.doc.edges.length);
    const str = new XMLSerializer().serializeToString(exp.svg);
    ok('SVG serializa con xmlns', str.startsWith('<svg') && str.includes('http://www.w3.org/2000/svg'));

    // --- persistencia y auto-layout ---
    setTimeout(() => {
      const saved = JSON.parse(localStorage.getItem('diagramb.v1'));
      const cur = saved && saved.docs[saved.current];
      ok('localStorage guarda el diagrama', !!cur && cur.nodes.length === api.doc.nodes.length);

      document.getElementById('autoLayout').click();
      setTimeout(() => {
        const wrong = api.doc.edges.filter((e) => {
          const f = api.doc.nodes.find((m) => m.id === e.from);
          const t = api.doc.nodes.find((m) => m.id === e.to);
          return f && t && t.y <= f.y;
        });
        ok('auto-layout: las flechas apuntan hacia abajo', wrong.length === 0);
        const overlap = api.doc.nodes.some((m1) => api.doc.nodes.some((m2) => {
          if (m1.id >= m2.id) return false;
          const s1 = api.sizes[m1.id], s2 = api.sizes[m2.id];
          return m1.x < m2.x + s2.w && m2.x < m1.x + s1.w &&
                 m1.y < m2.y + s2.h && m2.y < m1.y + s1.h;
        }));
        ok('auto-layout: sin nodos encimados', !overlap);
        report(out);
      }, 800);
    }, 400);
  } catch (err) {
    out.push('ERROR ' + err.message + ' @ ' + (err.stack || '').split('\n')[1]);
    report(out);
  }
}

function report(out) {
  const pre = document.createElement('pre');
  pre.id = 'smokeResult';
  pre.textContent = out.join('\n');
  document.body.appendChild(pre);
}
