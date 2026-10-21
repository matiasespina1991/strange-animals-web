# TODO

## Pendientes — esperar elección del usuario antes de implementar

- [ ] Probar MySpace Music Player Extended en una página con URL independiente, con uno de los releases existentes y la estética de la captura. Repositorio: https://github.com/DeadSuperHero/myspace-music-player-extended. Revisar licencia, compatibilidad e integración al comenzar. No reemplazar todavía el reproductor de Listen. Si la prueba no gusta, eliminar únicamente la página experimental y sus archivos exclusivos.
- [x] Mostrar progreso real de descarga de fuentes mediante un círculo que se completa y porcentaje. Usar bytes descargados/total cuando el servidor informe el tamaño; mantener indicador indeterminado cuando no lo informe y mostrar “Preparing font…” durante la decodificación. Respetar filtros, cancelación y caché actuales.

## Tareas existentes

- [x] add swap button if two colors are set (Text color ↔ Label).
- [x] Si no hay mas de 1 familia no hagas que se abra los subtiles!!!
- [x] Si se abre los subtiles y el usuario clickea en el master tile de nuevo entonces que se elija la fuente que esta en el master tile y ya.
- [x] Agregar line height (guardado, importación y exportación).
- [x] Size, tracking y line height: caja numérica y slider debajo bien cercano.
- Deberian estar las fuentes agrupadas por categoria!! el mimso orden que en la coleccion. Justo debajo de Recommended, All, Favorites deberia ir chips con las categorias y que se extienda hacia la derecha y tenga scroll vertical.
- [x] La pestaña Recommended deberia llamarse Standard.
- Agrega un checkbox 'See all substyles' a la izquierda de '{n} families' en la ventana 'Fonts' y si esta checkeado automaticamente todas las fuentes que se muestran en All, Favorites y Standard deberian mostrarse las subcategorias tambien, osea la lista de tiles abierta de todas las que tengan mas de 1 style asi es mas facil ver.
- [x] Cuando se muestran los substyles, los estilos suelen no cargarse hasta que le haga hover sobre el tile... no deberia pasar. se deberian empezara cargar todos apenas abro el tile ese y apenas estan a la vista.
- [x] Si abro un tile de subestilos no deberia cerrarse uno abierto anteriormente, deberian permanecer ambos abiertos.
- Los tiles de las fuentes con mas de un estilo deberian tener un pequenio chevron del lado opuesto del pequenio texto de "{category} . {n} styles" del lado derecho que apunte a la izquierda cuanto esta cerrada la lista de subcategorias y hacia abajo cuando esta abierta. si hago click en el chevron se abre y cierra la lista, no se seleccinoa la fuente master...
- [x] deberia aparecer el string '{n} styles' solo si hay mas de uno, si hay masde uno debe aparecer en negrita tambien el numero y string 'styles'.
- [x] Decorative border desactivado por defecto y control junto a Side / Preview.
- [x] mientras carga la fuente debe mostrar un loading circle, no mostrar default font
- [x] El centro del preview siempre blanco, independiente del sleeve.
- [x] Sombra aplicada solo al label, no al SVG completo ni a las guías.
- [x] Círculos de colores más chicos y mismo tamaño en paletas y accesos rápidos.
- si cambio la fuente el scroll debe volver al punto donde estaba la feuente seleccionada
- [x] agregar este efecto de bleed a los dos configuradores (slider Ink bleed, desactivado por defecto; colección en Typography, vinilo en Preview).
  https://andyjakubowski.com/tutorial/ink-bleed-effect-with-svg-filters
