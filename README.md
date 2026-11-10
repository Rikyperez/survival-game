# Pradera — survival-game

Base de un juego 3D en tercera persona con Three.js: valle de pasto, montañas
que delimitan el mundo y un personaje articulado que camina y corre.
Sin combate, inventario ni objetivos por ahora.

## Jugar desde el celular (sin PC)

Después de publicar la versión en GitHub Pages, abre:

**https://rikyperez.github.io/survival-game/**

No necesitas instalar Node.js ni descargar archivos en el teléfono. Usa un
navegador actualizado con WebGL 2 e internet. Pulsa **Explorar el valle**:
el modo **Celular** viene seleccionado para visitas nuevas. Usa el joystick
izquierdo para caminar, arrastra el escenario para mirar y mantén **Correr**
con otro dedo. El botón **Ⅱ** pausa la partida. Puedes girar el teléfono
para jugar en horizontal.

### Activar la publicación desde el teléfono

1. Integra estos cambios en la rama `main` del repositorio.
2. En GitHub, abre **Settings → Pages → Build and deployment → Source** y
   selecciona **GitHub Actions**. Si no ves Settings, activa «Sitio de
   escritorio» en el menú del navegador y comprueba tus permisos.
3. En **Actions**, abre **Publicar juego en GitHub Pages** y pulsa
   **Run workflow** en `main` si no hay una publicación en curso.
4. Espera a que termine correctamente y abre el enlace de arriba. Si aparece
   un 404, comprueba que Pages esté activado y que el trabajo `deploy` haya
   finalizado. El enlace no funciona hasta completar la primera publicación.

Cada cambio posterior en `main` vuelve a compilar y publicar el juego.
La disponibilidad de Pages depende del plan y la visibilidad del repositorio.

## Desarrollo local (opcional, con PC)

Requiere Node.js 22.12 o posterior y un navegador con WebGL 2.

```sh
npm install
npm run dev
```

Abre la dirección que muestra Vite. Para acceder desde otro dispositivo de tu
red, ejecuta `npm run dev -- --host 0.0.0.0`.

```sh
npm run build
npm run preview
```

## Controles

El selector **Jugar en: PC / Celular**, siempre visible en la barra superior,
permite cambiar de modo antes de entrar o durante la partida. Se inicia en
**Celular** al abrir el juego por primera vez y se recuerda la elección
en ese navegador cuando el almacenamiento está disponible.

En **Celular** aparecen el joystick y el botón «Correr» durante la partida,
junto con la ayuda táctil. En **PC** se ocultan los controles táctiles y aparece
la ayuda de teclado y ratón, independientemente del tamaño de la pantalla.
Cambiar de modo cancela cualquier movimiento o pulsación activa.

- **WASD / flechas:** moverse en relación con la cámara.
- **Shift:** mantener para correr.
- **Arrastrar el ratón sobre el mundo:** girar la cámara.
- **Esc / botón de pausa:** pausar. «Volver al valle» reanuda.
- **Pantalla táctil:** joystick izquierdo para moverse, arrastrar el mundo para
  mirar y mantener «Correr» con otro dedo.

El mundo tiene límites físicos. El terreno se carga y libera por bloques
cercanos al jugador, con niebla y distancia de visión limitada. La resolución
de renderizado está limitada a 1,5 veces la resolución CSS para reducir el coste
en pantallas de alta densidad. No se descargan modelos ni texturas externos.
