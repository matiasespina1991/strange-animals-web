# TODO

- Mostrar solo el nombre del usuario arriba del todo cuando esta signeado, no nombre y apellido.
- a este boton dale 0.5rem de paddin inline:
  <button class="dc-load" style="
      padding-inline: 0.5rem;
  "><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>Project settings<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg></button>
- quita un poco de gap y dale lo mismo en padding inline a estos:
<div class="dc-font-scopes"><button aria-pressed="false">Standard</button><button aria-pressed="true">All</button><button aria-pressed="false">Favorites</button><label class="dc-all-styles"><input type="checkbox" checked="">See all substyles</label><span>1428 families</span></div>
- Aplicar SEO que corresponda al configurador para que aparezca correctamente cuando envio el link por whataapp por ejemplo.
- Agregar logo de google al boton de iniciar sesion con google.
- No hagas que al hacer click en el usuario me abra una ventana que diga account. Debería abrirse un drop down, lo que común y más cómodamente sucede generalmente en cualquier website. No veo un diálogo abrirse hace años. No sé cuál fue tu criterio para usar un diálogo pero usa un dropdown, hagamos todo más fácil.
- Sacame esto:
<p class="dc-anchor-note"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle"><circle cx="12" cy="12" r="10"></circle></svg>Type size changes. The circle stays put.</p>
- Si cliqueo en Type Faces Collection, se debe abrir en una ventana aparte.
- Export PSD implementado con capas y textos convertidos a formas. Pendiente validación visual en Photoshop; fuentes OTF/TTF/WOFF, sin WOFF2 ni scripts contextuales por ahora. Ver docs/design-configurator.md.
- Login personal conectado a Firebase (Google/email, registro, logout), independiente de la contraseña de acceso existente. Pendiente prueba con cuentas reales y confirmar Google/authorized domains en Firebase Console. Sin funciones nuevas condicionadas al login.
- Investigar por qué hay subestilos que no aparecen (pospuesto por ahora).
