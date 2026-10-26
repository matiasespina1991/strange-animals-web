# Vinyl Designer Configurator — auditoría histórica

> Esta revisión del 2026-10-20 quedó reemplazada por la auditoría actual en `docs/vinyl-designer-configurator-code-audit.md`. Sus métricas y prioridades son históricas.

Fecha: 2026-10-20. Estado: revisión; no se implementaron refactors ni se instalaron paquetes.

## Resumen y alcance

Revisé el editor, modelo, render SVG, exportación, controles de colores/imágenes, selector y carga de fuentes, CSS, scripts de tests, configuración de TypeScript/XO y workflow de despliegue. La colección de fuentes se considera una dependencia compartida, no una invitación a refactorizar toda esa página en este trabajo.

**El problema principal no es la falta de una librería:** XO ya está instalado. Faltan controles efectivos en CI, separación de responsabilidades, contratos únicos de dominio y tests de interacción reales. Instalar más herramientas sin integrar esos controles no arregla esto.

Datos de esta revisión:

- `DesignConfiguratorEditor.tsx`: 1809 líneas. El componente principal comienza en la línea 247 aproximadamente y concentra estado, efectos, persistencia, fuentes, imágenes, interacción, exportación y JSX.
- `design-configurator-model.ts`: 332 líneas; mezcla tipos, defaults, geometría, historial, importación y nombres de archivos.
- `design-configurator.css`: 213 líneas físicas, pero muchas contienen numerosas reglas comprimidas. La cifra no representa su complejidad real.
- `LabelArtwork.tsx`: 219 líneas; buen punto de centralización para mantener preview y exportación coherentes.
- `IdentityFontsPage.tsx`: 4810 líneas; deuda compartida relevante, pero fuera del núcleo del editor.
- XO selectivo sobre editor, modelo y artwork: **850 errores y 5 advertencias**. Incluye mucho formato; no equivale a 850 bugs. Hace falta clasificar y establecer una base reproducible.
- Los tres scripts existentes de tests pasan: modelo/configurador, selector de fuentes y catálogo.
- `tsc --noEmit --listFiles` desde la configuración raíz no lista archivos de la app. `tsc -p tsconfig.app.json --noEmit` sí analiza la app y falla con errores existentes en otras áreas, por ejemplo tipos de `matter-js`/`three`. No atribuir esos errores al configurador.
- Sin pruebas visuales ni mediciones de memoria/tiempos en navegador en esta auditoría. Los riesgos de rendimiento indicados abajo deben medirse; no son benchmarks.

Prioridades: **P0** controles que hoy pueden dar falsa seguridad; **P1** integridad, comportamiento y contratos; **P2** mantenibilidad y rendimiento; **P3** higiene y evolución. Dentro de cada grupo, ejecutar en el orden listado.

## P0 — controles de calidad que deben funcionar primero

| ID  | Evidencia / ubicación                                                                 | Ajuste propuesto                                                                                                                                                   | Criterio de terminado                                                  |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 01  | `package.json` usa `tsc --noEmit`; raíz con `files: []` y referencias                 | Apuntar el typecheck explícitamente a app y configuración Node; o configurar correctamente build mode y sus referencias.                                           | Un error de tipos deliberado en el editor hace fallar el comando y CI. |
| 02  | El typecheck real falla fuera del editor                                              | Resolver la base existente o crear un control temporal y explícito del alcance. No ocultar errores nuevos ni usar `skipLibCheck` para silenciar errores de la app. | Cero errores nuevos; deuda existente inventariada con dueño y fecha.   |
| 03  | `.github/workflows/deploy-hosting.yml` construye y despliega, sin pasos de lint/tests | Agregar job de calidad previo al deploy y comprobaciones en pull requests.                                                                                         | No se despliega si falla lint, typecheck o tests.                      |
| 04  | XO instalado, pero no integrado al workflow; 850 errores en muestra de tres archivos  | Clasificar formato frente a errores semánticos. Acordar formato y aplicar una pasada mecánica separada de cambios funcionales.                                     | Lint del alcance pasa; no hay excepciones generales nuevas.            |
| 05  | `package.json` no tiene comando `test` que agrupe los scripts existentes              | Agregar `test:configurator`, `lint:configurator`, `typecheck` y `check`; documentar el comando único.                                                              | Una ejecución local reproduce los controles de CI.                     |
| 06  | Tests actuales transpilan TS y reescriben imports a módulos `data:`                   | Mantenerlos mientras se migra a un runner real; no quitarlos antes de reemplazar su cobertura.                                                                     | Imports normales, descubrimiento de tests y reporte por caso.          |

## P1 — integridad de datos y comportamiento

| ID  | Evidencia / ubicación                                                                           | Ajuste propuesto                                                                                                                 | Criterio de terminado                                                                                                |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 07  | `LabelLayer` tiene campos de texto, circular e imagen en un único tipo                          | Convertir a unión discriminada `TextLayer / CircularTextLayer / ImageLayer` con base compartida.                                 | TypeScript rechaza `radius` en una imagen y `imageRatio` en texto; switches exhaustivos.                             |
| 08  | `patchLayer` recibe `Partial<LabelLayer>`                                                       | Crear operaciones tipadas por tipo de capa y comandos de dominio.                                                                | No se pueden generar estados inválidos desde un patch genérico.                                                      |
| 09  | Límites repetidos en editor, `TypographyValueControl`, importador y helpers                     | Centralizar `LAYER_LIMITS`, `TYPOGRAPHY_LIMITS`, `PRINT_LIMITS`, `IMAGE_LIMITS`. Separar máximo de slider y máximo de input.     | Size 200/500, Ink bleed 0–4 y line height 0–3 definidos una sola vez y probados.                                     |
| 10  | El importador solo reconoce `version: 2`, aunque el esquema ha evolucionado                     | Definir esquema actual y migraciones explícitas; distinguir valores ausentes, inválidos y legado.                                | Fixtures de versiones anteriores y roundtrip de cada propiedad.                                                      |
| 11  | `parseDesign` conserva `arc`; se retiraron botones y el significado persiste en geometría       | Acordar qué campos legacy se preservan y cuáles se migran; no borrarlos a ciegas.                                                | Archivos viejos mantienen orientación o reciben migración documentada.                                               |
| 12  | `selected`, `selectedLayers` y fallback `layers[0]` conviven en el editor                       | Una estructura de selección `{activeId, ids}` y un selector que devuelva capa válida o `null`.                                   | Tras borrar, undo, cambiar lado o abrir un archivo nunca se edita silenciosamente la primera capa.                   |
| 13  | Operaciones de borrar/duplicar/reordenar usan el elemento activo; color permite multiselección  | Documentar comandos de una capa frente a varias y reflejarlos en UI.                                                             | Tests que demuestren qué cambia con selección múltiple; ink bleed continúa siendo individual.                        |
| 14  | `selectFont` espera una promesa y luego cambia capa y cierra el diálogo                         | Añadir token de operación ligado a documento/lado/capa y política para respuestas obsoletas.                                     | Cambiar selección, cerrar picker o abrir proyecto durante una carga no aplica una respuesta vieja al contexto nuevo. |
| 15  | `importImage` captura `side` antes del await; al final compara variables de esa misma ejecución | Validar contexto vigente y límite de capas al completar, no solo al empezar.                                                     | Cambiar lado/proyecto durante lectura no selecciona un ID incorrecto ni supera 50 capas.                             |
| 16  | `SleeveImageControl` permite cargas asíncronas sucesivas sin invalidar las anteriores           | Usar request ID o cancelación para que gane la última acción.                                                                    | Una imagen vieja que termina tarde no reemplaza la nueva ni reaparece después de quitarla.                           |
| 17  | `TypographyValueControl` usa `Number(raw)` y clamp en cada tecla                                | Mantener draft textual; validar/normalizar al confirmar, admitiendo vacío temporal y decimales incompletos.                      | Se puede borrar y reescribir un número sin salto al mínimo; `NaN` no entra al modelo.                                |
| 18  | `number()`, `slider()` y `TypographyValueControl` tienen eventos de commit distintos            | Unificar inicio, cambio, commit y cancel de edición; agrupar por gesto, no solo por nombre de propiedad.                         | Mouse, teclado, blur y pointercancel producen undo predecible.                                                       |
| 19  | `parseDesign` trunca nombres/textos y ajusta números silenciosamente                            | Devolver resultado con advertencias de normalización; mostrar resumen al importar.                                               | El usuario sabe si se recortaron datos; no se presenta una importación alterada como idéntica.                       |
| 20  | Regex/MIME y límite de bytes no limitan dimensiones de imagen decodificada                      | Validar ancho, alto y presupuesto de píxeles; reescalar cuando corresponda.                                                      | Rechazo controlado de imágenes excesivas sin bloquear el editor.                                                     |
| 21  | Imágenes base64 dentro del documento y guardado en `localStorage`                               | Separar binarios del documento, preferentemente IndexedDB; mantener compatibilidad de JSON portable.                             | Proyectos con imágenes no dependen de una cuota pequeña de localStorage.                                             |
| 22  | Recuperación con debounce de 750 ms                                                             | Evaluar flush seguro al salir/ocultar la página y recuperación de último estado confirmado.                                      | Pruebas con cambios recientes y recarga; no prometer persistencia que el navegador no garantiza.                     |
| 23  | Guardar/abrir/importar/nuevo viven mezclados en handlers del editor                             | Servicio de proyectos con validación, migraciones y resultado tipado; estado de documento coherente.                             | Pruebas de cuota agotada, JSON inválido, nuevo/importado y undo.                                                     |
| 24  | PDF abre popup; `printLabel` añade CSS y espera fuentes sin propagar un resultado al editor     | Modelar preparación/impresión/fallo, limpiar ventana y gestionar cierres/errores.                                                | No queda un popup vacío ni éxito prematuro cuando falla la preparación.                                              |
| 25  | Fuente embebida se resuelve desde catálogo actual                                               | Verificar exportación de proyectos con fuentes eliminadas, variantes ausentes o bytes inaccesibles.                              | Errores accionables y ninguna exportación silenciosa con fuente sustituta.                                           |
| 26  | SVG usa filtros para ink bleed y fuentes embebidas; tests actuales son SSR/pure logic           | Agregar tests reales SVG→PNG y PDF/impresión en navegador.                                                                       | Se valida forma, color, transparencia, tamaño físico y efecto por capa.                                              |
| 27  | `TextSelectionGuide` mide `getBBox()`; filtro puede extender tinta fuera del bbox geométrico    | Definir si la selección representa glifos o tinta filtrada; probar size 500, multiline, rotación e ink bleed 4.                  | No se promete que el bbox geométrico incluye la extensión visual del filtro.                                         |
| 28  | Eventos Escape en Modal, paletas, sleeve y confirmación tienen estrategias distintas            | Una política de capas: Escape cierra solo el overlay superior, sin disparar atajos de edición.                                   | Pruebas con picker + paleta + confirmación y pantalla completa.                                                      |
| 29  | Se eliminó globalmente el outline de foco a pedido de producto                                  | Registrar explícitamente esa excepción; proponer foco de teclado discreto como alternativa, sin revertir el diseño por sorpresa. | Navegación por teclado evaluada y decisión documentada. No asumir que una web interna elimina esa necesidad.         |
| 30  | Picker permite interacción detrás, pero otros diálogos son modales                              | Separar `FontPickerPanel` no modal de `ModalDialog`; cada uno con contrato claro de foco/scroll.                                 | Tab y Escape correctos; fondo desplazable solo donde corresponde.                                                    |

## P2 — arquitectura, redundancia y rendimiento

| ID  | Evidencia / ubicación                                                                                   | Ajuste propuesto                                                                                                            | Criterio de terminado                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 31  | Editor de 1809 líneas                                                                                   | Extraer por responsabilidad, no por cortes arbitrarios de líneas: toolbar, layers, stage, properties, font picker, dialogs. | El contenedor coordina componentes y comandos; no contiene sus implementaciones completas.              |
| 32  | Estado de fuentes, paginación, búsqueda, categorías, favoritos y hover dentro del editor                | Extraer `useFontPicker` y `FontPickerPanel`, separando catálogo remoto de estado visual.                                    | Selector testeable sin montar todo el editor.                                                           |
| 33  | Recuperación, guardado y estado de guardado mezclados en el editor                                      | Extraer `useProjectPersistence` y repositorio local inyectable.                                                             | Tests sin acceso directo a localStorage global.                                                         |
| 34  | Drag, transforms SVG y shortcuts dentro del editor                                                      | Extraer `useLayerDrag` y `useEditorShortcuts`; geometría pura por separado.                                                 | Tests de rotación, límites y cancelación independientes del JSX.                                        |
| 35  | Fullscreen nativo/fallback gestiona body y listeners en el editor                                       | Extraer `useEditorFullscreen` con cleanup y errores de salida.                                                              | Entrar/salir/denegación/desmontaje restauran el body y el estado.                                       |
| 36  | `design-configurator-model.ts` mezcla siete responsabilidades                                           | Separar types, defaults, limits, geometry, history, schema y filename.                                                      | Dependencias unidireccionales, sin ciclos; tamaños moderados.                                           |
| 37  | UI importa `resolveLabelFont` desde `design-configurator-export.tsx`                                    | Mover resolver/cache a `label-font-service.ts`; exportación y UI lo consumen.                                               | Previews no dependen conceptualmente del módulo de exportación.                                         |
| 38  | Defaults de familia/nombre/archivo repartidos entre editor y export                                     | Registro `DEFAULT_LABEL_FONTS` con key, familia, nombre, URL y formato.                                                     | Cambiar una fuente de sistema requiere una única edición.                                               |
| 39  | Geometría repite `600`, `300` y conversiones milímetros→SVG                                             | `LABEL_VIEWBOX_SIZE`, centro y funciones de conversión comunes.                                                             | Coordenadas y dimensiones consistentes en modelo, drag, preview y export.                               |
| 40  | Lados A/B y arrays de opciones reaparecen en toolbar, export, templates y helpers                       | Constantes readonly para opciones de dominio repetidas: lados, alineaciones, formatos y MIME admitidos.                     | Solo se deduplican conceptos iguales; no abstraer listas distintas solo porque hoy coinciden.           |
| 41  | FileReader + decode + MIME/límites duplicados entre import de imagen y sleeve                           | Servicio `readValidatedImage()` con metadatos, error tipado y política compartida.                                          | Una implementación y tests para éxito, error y carga obsoleta.                                          |
| 42  | Búsqueda `.find` de fuentes en varios loops y render                                                    | Crear `fontsById` cuando cambie catálogo, si medición confirma beneficio; no memoizar todo por reflejo.                     | Sin lógica de lookup duplicada y perfil antes/después documentado.                                      |
| 43  | `JSON.stringify` de documento completo para cada comparación del reducer                                | Garantizar no-op por referencia desde comandos; luego eliminar comparación profunda del hot path.                           | Undo no registra no-ops y drag no serializa base64 en cada movimiento.                                  |
| 44  | Historial guarda hasta 100 documentos con imágenes embebidas                                            | Separar assets y medir memoria; valorar patches/inverse patches solo después.                                               | Sesión con imágenes y muchos cambios tiene presupuesto de memoria definido.                             |
| 45  | `JSON.stringify(design)` repetido en save/dirty/recovery y revisión de bbox con `JSON.stringify(layer)` | Usar revisión del documento y dependencias explícitas; serializar únicamente en fronteras de persistencia/exportación.      | Ningún stringify voluminoso en render ni por cada pointermove.                                          |
| 46  | Efecto de fuentes depende de A/B, families y errores completos                                          | Derivar claves necesarias y aislar estado de carga por clave; no reexplorar todo al mover una capa.                         | Mover texto no reinicia trabajo remoto ni recorre catálogo innecesariamente.                            |
| 47  | `fontPromises`, familias, errores y mapas de scroll tienen vida/límites diferentes                      | Documentar dueño, invalidación, retry y límites de caches; limitar historial de búsquedas.                                  | Cambiar fuente publicada o reintentar un error funciona; no crece sin límite por consultas arbitrarias. |
| 48  | `createLabelSvg` resuelve secuencialmente por capa y descarga defaults siempre                          | Deduplicar claves primero; cargar recursos independientes con concurrencia acotada; incluir solo defaults realmente usados. | Exportaciones iguales no repiten trabajo innecesario; fallos por recurso identificables.                |
| 49  | UI permite “See all substyles” y carga mediante IntersectionObserver                                    | Medir número de observers, solicitudes concurrentes y nodos; añadir cola acotada y virtualización solo si hace falta.       | Prueba con catálogo grande y carga lenta; no instalar un virtualizador sin demostrar necesidad.         |
| 50  | CSS contiene reglas comprimidas, repetidas y overrides al final                                         | Formatear y consolidar por componente; eliminar declaraciones anuladas; conservar breakpoints intencionales.                | Cada propiedad importante tiene fuente clara; sin cascada correctiva acumulativa.                       |
| 51  | `!important`, `:has`, márgenes negativos y selectores basados en estructura conviven                    | Clases explícitas de variantes (`font panel`, `compact`, etc.) y tokens CSS.                                                | Cambiar orden de hijos o contenido no altera inadvertidamente layout/estilo.                            |
| 52  | Sidebar usa `contain:size`; fuentes cambian contenido/altura                                            | Test de layout con ninguna selección, texto, circular e imagen, ancho reducido y scrollbars reales.                         | Canvas conserva rectángulo al cambiar selección en desktop; móvil conserva su comportamiento propio.    |
| 53  | Handlers inline largos y helpers `number`/`slider` generan controles diferentes                         | Unificar `NumericField`/`RangeField` y pasar callbacks cortos con intención.                                                | Menos código duplicado y semántica de edición uniforme.                                                 |
| 54  | Listas de acciones/íconos/labels tienen representaciones paralelas                                      | Config readonly de acciones cuando correspondan, usando discriminantes y `satisfies`.                                       | No hay arrays paralelos que dependan de índices coincidentes.                                           |
| 55  | Colores se normalizan con `toLowerCase()` en varios módulos                                             | `normalizeHex`, `sameColor`, contraste y constantes de paleta compartidas; tests de duplicados case-insensitive.            | UI y dominio no discrepan; no eliminar colores distintos por “parecidos”.                               |
| 56  | Tipo de estado `mobileTab`, formato y lados de exportación son strings amplios                          | Uniones literales y mapas exhaustivos para estados/opciones.                                                                | Typo detectado por TypeScript.                                                                          |
| 57  | `makeLayer()` es usado como base de importación y creación                                              | Separar creación interactiva con UUID de defaults/migración determinista.                                                   | Parsear un proyecto no depende de efectos ni de creación accidental de IDs.                             |
| 58  | `mark` persiste y existe UI, pero su SVG está comentado en `LabelArtwork`                               | Determinar si se elimina, se depreca o se implementa.                                                                       | Ningún control modifica una propiedad sin efecto; migración explícita si se elimina.                    |

## P3 — limpieza, observabilidad y sostenibilidad

| ID  | Evidencia / ubicación                                                         | Ajuste propuesto                                                                                              | Criterio de terminado                                                        |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 59  | JSX/modelo/CSS tienen nombres y estilos de código inconsistentes              | Convención de nombres de archivos, tipos, funciones y callbacks; formateador único.                           | No hay diffs de formato intercalados en cada cambio funcional.               |
| 60  | Múltiples declaraciones con comas y nombres `c`, `l`, `s`, `d`, `number`      | Declaraciones separadas y nombres de intención en handlers/domain; permitir índices breves en loops simples.  | Se entiende qué representa cada valor sin reconstruir contexto.              |
| 61  | UI mezcla inglés/español y textos de error inline                             | Catálogo de mensajes/códigos, idioma consistente y traducción separada.                                       | Tests no dependen de mensajes internos para identificar errores.             |
| 62  | `catch` de hover descarta fallos intencionalmente, otros muestran strings     | Clasificar errores esperados frente a bugs; logging de desarrollo y mensajes seguros, sin datos del proyecto. | Los fallos inesperados son diagnosticables sin filtrar base64 ni documentos. |
| 63  | `FontSpecimen` ofrece retry en un span con onClick                            | Convertir retry en control accesible evitando anidar botones en tiles.                                        | Se puede reintentar con teclado y no seleccionar accidentalmente la fuente.  |
| 64  | `ColorSwatches`, sleeve y Modal comparten outside/Escape/focus                | Hook o primitiva pequeña compartida, conservando diferencias de comportamiento.                               | No se acumulan listeners y Escape afecta un único nivel.                     |
| 65  | Paletas, popovers y preview dependen de límites de contenedores               | Casos de clipping/z-index/scroll y fullscreen en tests de integración.                                        | Paleta visible tanto en toolbar como en properties.                          |
| 66  | TODO conserva pendientes que ya están hechos                                  | Separar backlog técnico, funcional y completado; enlazar tests/PR.                                            | Una fuente única de estado; no repetir implementaciones terminadas.          |
| 67  | `docs/design-configurator.md` todavía menciona upper/lower y arcos de 30–350° | Actualizar contrato de usuario y datos al comportamiento actual.                                              | Documentación coincide con UI y schema.                                      |
| 68  | No hay presupuesto de bundle específico del editor                            | Medir carga inicial y evaluar lazy imports de diálogos/exportación.                                           | Objetivo medible de KB/tiempo; no dividir chunks a ciegas.                   |
| 69  | No hay matriz de regresión automatizada de interacciones                      | Fixtures de proyectos chicos/grandes, fonts lentas, storage lleno y fallo remoto.                             | Casos reproducibles localmente y en CI.                                      |
| 70  | Números/estructura máximos son convenciones todavía sin control               | Incorporar los límites de la sección siguiente al lint y revisión, con excepciones justificadas.              | Cambios nuevos cumplen reglas; no “arreglar” límites comprimiendo líneas.    |

## Reglas propuestas para cumplir en los siguientes cambios

Son objetivos de proyecto, no verdades universales. Primero configurar y migrar el alcance; no afirmar que ya están aplicados. Para archivos legacy, impedir crecimiento y extraer gradualmente; excepciones con motivo, responsable y fecha. Nunca desactivar reglas globalmente para pasar una tarea.

| Regla                   | Umbral objetivo                                                | Aplicación                                                                                           |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Líneas por archivo      | 300 lógicas; aviso desde 250                                   | `max-lines`, sin comentarios/blancos. Tests/configs/datos pueden tener excepción explícita.          |
| Función de lógica       | 60 líneas                                                      | `max-lines-per-function`; componentes JSX hasta 120 por override, sin perder control de complejidad. |
| Complejidad ciclomática | 10                                                             | `complexity`; aviso inicial, error tras migración.                                                   |
| Complejidad cognitiva   | 15                                                             | SonarJS opcional, después de verificar compatibilidad con XO.                                        |
| Anidamiento             | 3 niveles                                                      | `max-depth`; preferir retornos tempranos.                                                            |
| Parámetros              | 4                                                              | `max-params`; objetos de opciones tipados cuando hay más.                                            |
| Tamaño de línea         | Formateador 100 columnas como objetivo                         | No romper URLs/cadenas o JSX artificialmente para obedecer un número.                                |
| Hooks                   | Reglas de hooks + dependencias exhaustivas                     | Sin supresiones sin explicación y test.                                                              |
| Promesas                | No floating/misused promises                                   | Operaciones async esperadas, capturadas o explícitamente descartadas con política de error.          |
| Tipos                   | Sin `any` nuevo; imports de tipos consistentes                 | Recuperar reglas `no-unsafe-*` por alcance, no un cambio global sin inventario.                      |
| Casts                   | No `as` para esconder contratos inválidos                      | Validar `unknown` en fronteras; `satisfies` para config.                                             |
| JSX                     | Sin handlers extensos ni lógica de dominio en render           | Extraer por responsabilidad, no crear wrappers inútiles.                                             |
| Constantes              | Una fuente para límites/defaults/opciones de dominio repetidas | No abstraer cada literal ni dos arrays con significados distintos.                                   |
| Duplicación             | Sin bloques nuevos copiados sin motivo                         | Detector informa; revisión decide si realmente son el mismo concepto.                                |
| Estado                  | Una representación canónica; derivar el resto                  | No sincronizar redundancias con cadenas de effects.                                                  |
| CSS                     | Legible, selectores acotados, sin duplicados accidentales      | Tokens de spacing/dimensiones; excepciones de `!important` documentadas.                             |
| Comentarios muertos     | No bloques de código comentados                                | Git conserva historia; documentar razones, no repetir el código.                                     |
| Cambios funcionales     | Test de regresión y check del alcance                          | No llamar “verificado visualmente” a tests SSR o estáticos.                                          |

Ejemplo orientativo de reglas ESLint compatibles conceptualmente con XO; adaptar al formato y versiones **instaladas**, no copiar configuración moderna de XO sobre 0.60 sin migración:

```json
{
  "max-lines": [
    "error",
    { "max": 300, "skipBlankLines": true, "skipComments": true }
  ],
  "max-lines-per-function": [
    "warn",
    { "max": 60, "skipBlankLines": true, "skipComments": true }
  ],
  "complexity": ["warn", 10],
  "max-depth": ["error", 3],
  "max-params": ["warn", 4],
  "no-duplicate-imports": "error",
  "@typescript-eslint/consistent-type-imports": "error",
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": "error"
}
```

No activar reglas base y sus equivalentes TypeScript a la vez cuando se reemplazan. Resolver conflictos con las reglas de importación que XO ya trae. Evitar aplicar `max-statements` rígido a componentes JSX.

## Herramientas: qué mantener y qué instalar

### Orden recomendado

1. **Mantener XO** como linter principal. Ya está en `devDependencies` (`^0.60.0`) y `lint` ejecuta XO. No instalar otro linter general en paralelo. Revisar qué plugins trae esa versión antes de duplicarlos. La documentación actual puede corresponder a una versión mayor: migración separada y probada. [XO oficial](https://github.com/xojs/xo).
2. **`eslint-plugin-react-hooks`** si la configuración efectiva no lo incluye: reglas de hooks/dependencias. Verificar peers con la versión de ESLint que usa XO. [React oficial](https://react.dev/reference/eslint-plugin-react-hooks).
3. **`vitest`**, **`@testing-library/react`**, **`@testing-library/user-event`**, **`@testing-library/jest-dom`** y un entorno DOM compatible para modelo, hooks y componentes. No reemplaza pruebas reales de SVG. Elegir versiones compatibles con Vite/Node actuales: la documentación actual de Vitest exige una versión de Vite superior al mínimo declarado `^6.0.3` del proyecto. Comprobar versión resuelta antes de instalar. [Vitest](https://vitest.dev/guide/), [Testing Library](https://testing-library.com/docs/react-testing-library/intro/).
4. **`@playwright/test`** para geometría real, scroll, drag, fuentes y exportaciones. **`@axe-core/playwright`** como complemento de accesibilidad, no certificado automático. [Playwright](https://playwright.dev/docs/intro), [axe](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright).
5. **`stylelint` + `stylelint-config-standard`** para el CSS. Activar detección de selectores/propiedades duplicadas; baseline inicial antes de hacerlo bloqueante. [Stylelint](https://stylelint.io/user-guide/get-started/).

### Segunda etapa, solo con necesidad concreta

- **`knip`**: candidatos a exports, archivos y dependencias sin uso. Revisar resultado antes de eliminar; scripts/entradas dinámicas necesitan configuración. [Knip](https://knip.dev/).
- **`jscpd`**: reporte de copy/paste en TS/TSX/CSS. Baseline por feature, excluyendo generados/assets/vendor. No usar porcentaje global como sustituto de revisión. [jscpd](https://github.com/kucherenko/jscpd).
- **`eslint-plugin-sonarjs`**: complejidad cognitiva y duplicaciones lógicas. La documentación del repositorio antiguo indica integración en el repositorio SonarJS; verificar paquete mantenido y compatibilidad antes de adoptar. [SonarJS](https://github.com/SonarSource/eslint-plugin-sonarjs).
- **`dependency-cruiser`**: impedir ciclos y dependencias UI→export→repositorio. Adoptar cuando estén definidos límites de módulos. [dependency-cruiser](https://github.com/sverweij/dependency-cruiser).
- **Zod o Valibot**: opcional para schema/migraciones si reduce código de validación; no usar dos ni sumar una librería solo por moda. El parser actual se puede mejorar sin dependencia.
- **Husky + lint-staged**: comodidad local opcional después de que CI funcione; no reemplazan CI. Evitar auto-fix masivo de archivos ajenos a cada cambio.

No recomiendo instalar ahora Redux, una segunda store ni un framework de formularios para resolver este editor. El reducer y componentes controlados alcanzan una vez ordenados. Tampoco cambiar XO por Biome/Oxlint al mismo tiempo que se divide el editor: mezcla demasiados riesgos.

## Plan de implementación en cuatro partes

### 1. Hacer confiables los controles

IDs 01–06. Congelar fixtures y tests existentes; resolver typecheck real, formato del alcance y comandos de calidad. Agregar CI antes de cambios estructurales. No mezclar formateo con refactor funcional.

### 2. Fijar contratos y comportamiento

IDs 07–30. Límites únicos, capas discriminadas, selección canónica, ediciones numéricas y undo consistentes, protección de resultados async, schema/migraciones. Agregar tests de los bugs antes de corregirlos.

### 3. Dividir sin cambiar la experiencia

IDs 31–58. Extraer componentes/hooks/servicios en pasos chicos; eliminar duplicación real, limpiar CSS y medir hot paths. Mantener render SVG compartido para preview/export. Cada extracción debe pasar el mismo set de pruebas.

### 4. Endurecer y sostener

IDs 59–70. E2E y regresión visual, análisis de código muerto/duplicación, presupuestos y documentación. Convertir warnings acordados en errores cuando el alcance esté limpio.

## Checklist obligatorio para futuros cambios del configurador

- [ ] Confirmar que la tarea no existe ya y no duplica un módulo/constante.
- [ ] Leer esta política y comprobar límites antes de añadir código al editor gigante.
- [ ] Cambiar conjuntamente control, dominio, importación y tests cuando cambia un límite.
- [ ] No añadir estado derivable, listeners sin cleanup ni respuestas async sin política de obsolescencia.
- [ ] No crear excepciones de lint globales para evitar una corrección local.
- [ ] Mantener Ink bleed por capa y diferenciarlo del sangrado físico de impresión.
- [ ] Probar undo/redo, persistencia y export si el cambio afecta el documento.
- [ ] Ejecutar checks y detallar cuáles se ejecutaron realmente y cuáles siguen bloqueados.
- [ ] Actualizar docs/TODO cuando cambia el comportamiento público o un formato persistido.

Este documento es una propuesta operativa y un backlog priorizado, no una afirmación de que todos los fallos potenciales se reprodujeron. Los riesgos async, memoria, filtros y compatibilidad requieren los tests/mediciones indicados antes de decidir la solución final.
