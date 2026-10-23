# Briefing: texto 3D en el Designer Configurator

## Contexto para el agente

El usuario me asignó analizar `todo_circular_3d_text.md`, `todo_3d_text.md` y la web/código del Designer Configurator, y preparar una síntesis para que otro agente pueda continuar el trabajo sin depender de esta conversación. Esta nota es esa síntesis. La revisión fue de solo lectura: no se implementó ninguno de los dos efectos.

La intención es integrar en el Designer Configurator dos efectos de texto 3D **fijos y estáticos**. No son dos versiones del mismo efecto: uno construye texto alrededor de un cilindro segmentado; el otro crea profundidad apilando copias del texto. No agregar animación de ningún tipo: ni rotación continua, flotación, wobble, retrasos entre capas, movimiento individual ni controles de reproducción/velocidad. Una orientación o ángulo fijo que el usuario pueda editar sí forma parte del efecto estático. Conservá las funciones existentes y decidí la mejor forma de exponer ambos efectos en la interfaz.

El agente que implemente esto debe inspeccionar el estado actual del código antes de actuar. Si descubre que otra arquitectura encaja mejor, que una parte de esta nota está desactualizada o que una decisión literal causaría problemas de edición/exportación, puede cambiarla por una solución mejor. La nota explica intención y contexto, no impone nombres de tipos, componentes ni una técnica de render específica.

## Material leído

- `todo_circular_3d_text.md`: prototipo HTML/SCSS y transcripción de una demostración CSS. El efecto principal divide una frase en paneles estrechos, los distribuye alrededor del eje Y y los hace rotar como un anillo/cilindro.
- `todo_3d_text.md`: referencia sobre texto 3D por capas y variaciones. Describe el apilado de duplicados a lo largo de Z, además de ejemplos animados, decoraciones y patrones. Los ejemplos de movimiento son material de referencia, no alcance de implementación.
- `docs/design-configurator.md`: documentación funcional y de exportación del configurador actual.
- Ruta revisada en el navegador: `/identity/design-configurator`. Está dentro de Identity y protegida por `IdentityAccessGate`. La página muestra inicialmente el proyecto “Other frequencies”, con dos caras A/B, panel de elementos, preview SVG y panel de propiedades.

## Cómo está construido el configurador actual

- `src/features/identity/IdentityRoute.tsx` registra la ruta `/identity/design-configurator` dentro del gate de acceso de Identity.
- `src/features/identity/DesignConfiguratorEditor.tsx` contiene la experiencia principal: selección de cara y capas, controles, picker de fuentes, plantillas, importación, historial, guardado, recuperación, exportación y presentación responsive.
- `src/features/identity/design-configurator-model.ts` define `LabelDesign`, `LabelLayer`, los valores iniciales, `makeLayer`, validación/importación (`parseDesign`) y el reducer de undo/redo. El modelo actual declara `kind: "text" | "circular" | "image"`. `LabelDesign` es versión 2.
- `src/features/identity/LabelArtwork.tsx` dibuja el disco como SVG en un `viewBox` de 600 × 600. El texto normal se renderiza con `<text>` y `<tspan>`; el tipo `circular` se dibuja con `<textPath>` sobre `circularPath`. Cada grupo editable tiene su id, selección, teclado y eventos de pointer para arrastrarlo.
- `src/features/identity/design-configurator.css` contiene el layout de escritorio/móvil y los estilos del editor. A menos de 800 px, los paneles se convierten en pestañas fijas Elements / Properties / Fonts.
- `src/features/identity/design-configurator-export.tsx` crea SVG desde `LabelArtwork`, resuelve e incrusta las fuentes; PNG se rasteriza desde ese SVG y PDF usa el diálogo de impresión del navegador.
- `src/features/identity/design-configurator-psd.ts` crea un PSD a 600 PPI con grupos y capas por elemento. El texto se convierte a contornos vectoriales cuando se puede decodificar la fuente.
- La recuperación automática usa `sa-label-design-recovery-v2`; el guardado explícito usa `sa-label-design-draft`. Los proyectos JSON se importan mediante `parseDesign`.
- El configurador carga fuentes del catálogo de Identity y Firebase Storage. Los nombres/familias de fuente runtime se resuelven al abrir un proyecto.

## Tarea 1: texto cilíndrico segmentado

### Intención visual

Implementar el efecto del prototipo de `todo_circular_3d_text.md`: una frase parece envolver la cara visible de un cilindro/anillo mediante paneles verticales proyectados. La pose queda fija; no hay rotación continua ni animación.

El prototipo parte de 24 paneles de ancho aproximado 50 px y radio aproximado 190 px. Para el panel de índice `i`, calcula su ángulo como `360° * i / N`, desplaza el texto compartido hacia atrás aproximadamente `ancho * i`, recorta el panel con `overflow: hidden` y lo coloca con `rotateY(ángulo) translateZ(radio)`. Un contenedor con `perspective` y `transform-style: preserve-3d` permite percibir el volumen. La referencia también rota el grupo continuamente; eso es solo una demostración del tutorial y queda expresamente fuera de alcance. El resultado del configurador debe permanecer inmóvil en una pose 3D fija.

### Distinción importante

No confundir este efecto con el texto circular actual del disco. El `kind: "circular"` existente sigue una ruta bidimensional alrededor de la etiqueta mediante SVG `<textPath>`. El efecto de referencia forma una banda/cilindro 3D segmentado; no es simplemente un radio nuevo para el mismo `textPath`. Preservá el texto sobre arco actual y agregá el nuevo comportamiento de forma que el usuario pueda distinguirlos.

El agente puede decidir si conviene modelarlo como un estilo del texto, un tipo de elemento adicional o una composición de elementos. No cambies la semántica actual de “Arc text” sin confirmar que eso expresa mejor la intención y que los proyectos viejos siguen abriendo igual.

### Qué resolver

- Convertir el prototipo en una implementación propia de React/CSS/SVG compatible con el editor. El SCSS del documento es una referencia conceptual, no un archivo listo para importar.
- Corregir las expresiones que aparecen con `_` donde deberían existir operaciones aritméticas. No copiar esas expresiones literalmente: Vite no compila SCSS dentro de un `.css` normal.
- Definir y limitar los parámetros útiles para edición, por ejemplo número de segmentos, radio/profundidad, ancho de panel y orientación fija. Elegí rangos que no desborden ni bloqueen la interfaz.
- Mantener el texto, fuente, tamaño, tracking, color y alineación coherentes con los controles de texto que ya existen, o justificar explícitamente cualquier diferencia necesaria para el efecto.
- Evitar huecos visibles entre paneles, saltos al cerrar el círculo, texto cortado en costuras y cambios de alineación al cambiar la longitud de la frase o la fuente.
- Hacer que el objeto se pueda seleccionar y editar con los patrones existentes de capas. Evaluá con cuidado el arrastre: una transformación 3D cambia la relación entre coordenadas de pantalla y coordenadas del diseño.
- No animar la rotación ni ninguna otra propiedad. El ángulo actual debe ser un valor estático del diseño, visible y editable; el preview y cada export deben representar esa misma pose.

### Exportación

El preview 3D no basta si el usuario espera imprimir o exportar el diseño. El exportador actual genera SVG y luego lo usa como fuente de PNG/PDF/PSD; las transformaciones CSS 3D arbitrarias no necesariamente se conservarán al serializar/renderizar SVG ni en el PSD. Antes de elegir la técnica, decide cómo se representará el resultado fuera del editor:

- producir una forma vectorial determinista en SVG, si puede conservar el efecto con fidelidad suficiente; o
- generar una imagen raster de alta resolución para el efecto y mantener los demás elementos como capas/vector, si el efecto no se puede representar de forma fiable en SVG.

El agente puede elegir otra estrategia si las APIs actuales lo permiten mejor. Deja explícito si una opción afecta solo al preview o también a los formatos de salida; no presentes como imprimible un efecto que desaparece al exportar.

## Tarea 2: texto extruido/apilado por capas

### Intención visual

Implementar el concepto de `todo_3d_text.md`: varias copias del mismo texto, apiladas en pequeños incrementos de Z, producen grosor/extrusión. La referencia usa una capa superior legible y capas adicionales desplazadas hacia atrás; un contenedor 3D controla perspectiva y `preserve-3d`. Los ejemplos de flotación, oscilación, contrarrotación animada, retrasos por capa y movimiento individual quedan fuera de alcance. El objeto y su extrusión deben permanecer estáticos. Decoraciones o patrones en el relleno no son necesarios para esta tarea.

La prioridad es que el editor tenga una extrusión ajustable, predecible y útil para una etiqueta. Elegí un conjunto de controles moderado, por ejemplo profundidad y cantidad/espaciado de capas. El preview no debe moverse por sí solo ni incluir controles de animación.

### Qué resolver

- Mantener un único contenido editable como fuente de verdad. Las copias de render no deben convertirse en capas independientes que el usuario tenga que corregir manualmente.
- Decidir el sentido de profundidad y el orden de pintado para que la cara superior quede limpia y el espesor sea visible sin tapar el glifo frontal.
- Asegurar que tamaño, tracking, line-height, fuente, color y alineación se apliquen de forma consistente a todas las copias.
- Limitar la cantidad de nodos/capas y medir el efecto en varios elementos simultáneos. Una extrusión puede generar muchos nodos aun sin animación; empieza con un número acotado y evita crear un elemento por carácter salvo que sea imprescindible.
- Mantener la selección, el drag, el foco de teclado, el zoom y el preview estables cuando el texto se extruye.
- Mantener siempre un estado estático, determinista y directamente editable. No agregar animación ni variantes de movimiento; no hace falta un modo reducido de movimiento porque no debe existir movimiento.
- Los patrones, adornos y ejes de fuentes variables son posibilidades futuras, no requisitos para el primer alcance. No agregues controles que el modelo o la exportación no puedan sostener.

### Exportación

Al igual que para el cilindro, la extrusión debe tener una salida definida en SVG, PNG, PDF y PSD. Una pila determinista de texto o formas vectoriales podría encajar mejor con el exportador actual que una escena que dependa exclusivamente de CSS 3D; valida el resultado real y la legibilidad antes de decidir. En PSD, considera cómo se agrupa la cara superior y el espesor y cómo convive esto con el contorneo actual de texto y el ink bleed.

## Decisiones de modelo e integración

Esta sección propone preguntas, no una API obligatoria:

- Implementación actual: los dos modos son una propiedad `textEffect` opcional en capas `text` existentes, no tipos de capa nuevos. El selector ofrece ninguno, extrusión o cilindro; el arco 2D sigue separado y las imágenes/capas circulares no conservan `textEffect` al importarse.
- ¿Qué parámetros deben guardarse por capa para que al reabrir JSON/recuperación se vea el mismo resultado? Guarda solo los parámetros de diseño estáticos, no estado transitorio de hover o drag.
- Si se extiende `LabelLayer` o se agregan tipos, actualiza `makeLayer`, `initialDesign`, `parseDesign`, validación y migración de los drafts existentes. `parseDesign` hoy normaliza explícitamente los tipos conocidos; un valor nuevo podría degradarse a texto normal si no se adapta.
- Mantén compatibilidad con proyectos existentes de versión 2 y agrega defaults seguros para campos opcionales. No subas la versión ni descartes propiedades sin una razón concreta.
- Integra los controles en el panel Properties y conserva los patrones de `TypographyValueControl`, undo/redo y agrupación de cambios.
- Conserva la experiencia A/B independiente, la recuperación local, el guardado/importación JSON y la selección múltiple donde tenga sentido.
- El editor y los exportadores comparten `LabelArtwork`, pero no asumas que un ajuste visual de preview se refleja automáticamente en exportación. Puede hacer falta un renderer compartido con un modo determinista o una implementación de export específica.
- El editor y los exportadores comparten `LabelArtwork`; la geometría SVG estática se reutiliza para SVG/PNG/PDF. En PSD, el texto plano conserva contornos vectoriales y las capas con 3D se rasterizan por elemento porque el pipeline actual de contornos no representa bien segmentos/profundidad.

## Verificación sugerida

El script existente `node scripts/test-design-configurator.mjs` cubre historial, agrupación de cambios, validación/migración de proyectos y geometría circular. Extiéndelo o agrega pruebas enfocadas para los nuevos parámetros, defaults, límites y persistencia. Reutiliza los scripts del configurador existentes; evita crear una batería duplicada sin necesidad.

Después, prueba en navegador al menos:

- añadir, seleccionar, duplicar, cambiar de lado, mover, deshacer/rehacer y borrar cada tipo de texto;
- cambiar frase, tamaño, tracking y fuentes estrechas/anchas, con signos y saltos de línea;
- guardar, recargar, recuperar automáticamente, exportar JSON y volver a importarlo;
- exportar SVG, PNG y PDF; abrir el PSD y confirmar el aspecto, la agrupación y los contornos de las capas;
- escritorio y móvil, incluyendo el picker de fuentes, zoom y pestañas de panel;
- orientación/ángulo fijo, preview inmóvil y exportaciones repetidas con resultados estables.

## Criterios de aceptación

- Los dos efectos pueden distinguirse del texto plano y del texto circular 2D ya existente.
- Los controles no cambian de forma inesperada al editar fuente, contenido, tamaño o tracking.
- Los datos sobreviven guardado/recuperación e import/export sin romper proyectos existentes.
- La selección y el movimiento siguen siendo utilizables, también en móvil y con teclado.
- La salida exportada coincide con el diseño visible, o la interfaz informa de cualquier limitación concreta antes de exportar.
- Las pruebas enfocadas y el build pasan; cualquier limitación residual se documenta.

## Libertad de implementación

Antes de escribir código, el agente debe comprobar el estado actual de los archivos y tests: esta nota refleja la revisión realizada el 22 de octubre de 2026. Si encuentra una representación SVG, de canvas o de capas ya existente que resuelva mejor la perspectiva y los exports, úsala. Puede cambiar el plan o dividir una tarea si eso protege edición, rendimiento, compatibilidad o fidelidad de impresión, pero el resultado debe seguir siendo completamente estático y sin animación. Mantén los dos objetivos visuales y la diferencia entre ellos como guía central.
