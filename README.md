# diagramb

Editor minimalista de diagramas de flujo con nodos estilo tarjeta (título, subtítulo y tablas opcionales), flechas que se acomodan solas y exportación a SVG/PNG. Sin dependencias ni build: abre `index.html` en el navegador.

## Uso

- **Doble clic** en el lienzo: crear un nodo. **＋ Nodo** también funciona.
- **Clic** en un nodo o flecha: seleccionar y editar en el panel derecho (título, subtítulo, color, filas de tabla, etiqueta de la flecha).
- **Arrastrar desde un puerto azul** (aparecen al pasar el cursor sobre un nodo) hasta otro nodo: crear una flecha. Los lados de salida/llegada se eligen solos según la posición de los nodos.
- **Arrastrar un nodo**: moverlo; aparecen guías rosas cuando queda alineado con otro nodo (bordes o centros).
- **Rueda**: desplazar el lienzo · **⌘/Ctrl + rueda**: zoom · arrastrar el fondo también desplaza.
- **⌫** borrar selección · **⌘Z / ⌘⇧Z** deshacer y rehacer · **flechas** mover el nodo seleccionado (⇧ = pasos de 10).
- **SVG / PNG** en la barra superior: descarga el diagrama recortado al contenido, con fondo blanco (PNG a 2×).
- Los diagramas se guardan solos en `localStorage`; el selector de la barra superior permite tener varios, renombrarlos y borrarlos.

## Pruebas

`smoke.html` carga la app más `smoke-test.js`, que simula interacciones reales (arrastrar, conectar, deshacer, exportar) y muestra los resultados:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --virtual-time-budget=3000 --dump-dom "file://$PWD/smoke.html" \
  | awk '/<pre id="smokeResult">/,/<\/pre>/'
```
