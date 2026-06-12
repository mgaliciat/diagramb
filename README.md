# diagramb

Editor minimalista de diagramas de flujo con nodos estilo tarjeta (título, subtítulo y tablas opcionales), flechas que se acomodan solas y exportación a SVG/PNG. Sin dependencias ni build: abre `index.html` en el navegador.

## Uso

- **Doble clic** en el lienzo: crear un nodo. **＋ Nodo** también funciona.
- **Doble clic sobre un texto** (título, subtítulo o celda de tabla): editarlo inline, directamente en el lienzo. Enter guarda, Escape cancela.
- **Clic** en un nodo o flecha: seleccionar y editar en el panel derecho (título, subtítulo, color, filas de tabla, etiqueta de la flecha).
- **Markdown ligero en celdas de tabla**: `**negritas**` y `` `código` `` (este último con fondo tipo pill). Los marcadores se escriben tal cual al editar y se ocultan al renderizar.
- **Notas flotantes**: el campo "Nota" del panel agrega un post-it amarillo a la derecha de la tarjeta. Se mueve con ella y sale en la exportación, pero no tiene puertos ni puede recibir flechas. Doble clic sobre la nota lleva al campo de edición; vaciar el campo la quita.
- **⇧ + arrastre en el fondo**: selección múltiple por rectángulo. **⇧ + clic** agrega o quita nodos de la selección. El grupo se mueve junto, y el panel permite cambiar el color, **alinear** (izquierda/centro/derecha/arriba/medio/abajo), **distribuir** con espaciado uniforme (3+ nodos) o borrar todo a la vez.
- **Ordenar** (barra superior): auto-layout por capas siguiendo las flechas — raíces arriba, cada nivel debajo, ramas centradas bajo sus padres — con animación suave. Si no te gusta el resultado, ⌘Z lo revierte.
- **⌘C / ⌘X / ⌘V**: copiar, cortar y pegar nodos (con las flechas entre ellos), incluso entre diagramas distintos.
- **Arrastrar desde un puerto azul** (aparecen al pasar el cursor sobre un nodo) hasta otro nodo: crear una flecha. Los lados de salida/llegada se eligen solos según la posición de los nodos. Al soltar aparece un **popup para elegir el tipo de flecha**: dirección (→/↔), línea continua o punteada, grosor y color; la siguiente flecha recuerda lo último elegido. Los mismos controles están en el panel al seleccionar una flecha, y **doble clic sobre la flecha o su etiqueta** edita la etiqueta inline.
- **Tema oscuro**: botón 🌙/☀️ en la barra; la exportación respeta el tema activo.
- **Compartir**: copia un enlace con el diagrama completo comprimido en la URL (sin servidor); al abrirlo se importa como diagrama nuevo.
- **Arrastrar un nodo**: moverlo; aparecen guías rosas cuando queda alineado con otro nodo (bordes o centros).
- **Rueda**: desplazar el lienzo · **⌘/Ctrl + rueda**: zoom · arrastrar el fondo también desplaza.
- **⌫** borrar selección · **⌘Z / ⌘⇧Z** deshacer y rehacer · **flechas** mover los nodos seleccionados (⇧ = pasos de 10).
- **SVG / PNG** en la barra superior: descarga el diagrama recortado al contenido, con fondo blanco (PNG a 2×).
- **JSON / Importar**: exporta el diagrama actual como archivo `.json` de respaldo, o importa uno como diagrama nuevo.
- Los diagramas se guardan solos en `localStorage`; el selector de la barra superior permite tener varios, renombrarlos y borrarlos.

## Pruebas

`smoke.html` carga la app más `smoke-test.js`, que simula interacciones reales (arrastrar, conectar, deshacer, exportar) y muestra los resultados:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --virtual-time-budget=3000 --dump-dom "file://$PWD/smoke.html" \
  | awk '/<pre id="smokeResult">/,/<\/pre>/'
```
