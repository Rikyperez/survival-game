# Pradera — survival-game

Juego 3D de fantasía en tercera persona con Three.js. Explora cinco biomas con
pueblos, comerciantes, enemigos y encargos abiertos. Elige entre caballero,
mago, tanque, arquero y nigromante; cada clase tiene una habilidad especial.
Sube de nivel, desbloquea talentos, consigue equipo de seis rarezas y combate
contra enemigos que persiguen y atacan al jugador. El maniquí de Lindeverde
permite practicar. Cada bioma tiene una entrada a una mazmorra instanciada y un
jefe de zona propio.

Las cinco mazmorras incluyen pasillos, salas de tesoro, trampas, grupos de
enemigos y un jefe final. Los enemigos comunes reaparecen mientras exploras.
Cada jefe de mazmorra y jefe de zona vuelve 12 horas reales después de ser
derrotado; la hora queda guardada en el navegador. Derrotar al jefe puede soltar
una pieza única de su conjunto con 10% de probabilidad por victoria. Entra por
el arco y usa **E** (o «Entrar a la mazmorra» en celular); cerca de un cofre
pulsa **E** para abrirlo y usa «Salir de la mazmorra» para volver al mismo lugar.
Si el jefe está en espera, todavía puedes explorar, abrir cofres y combatir.

## Jugar desde el celular (sin PC)

Después de publicar la versión en GitHub Pages, abre:

**https://rikyperez.github.io/survival-game/**

No necesitas instalar Node.js ni descargar archivos en el teléfono. Usa un
navegador actualizado con WebGL 2 e internet. Pulsa **Explorar el valle**:
el modo **Celular** viene seleccionado para visitas nuevas. Usa el joystick
izquierdo para caminar, arrastra el escenario para mirar y mantén **Correr**
con otro dedo. El botón **Ⅱ** pausa la partida. Puedes girar el teléfono
para jugar en horizontal.

Durante la partida, el minimapa muestra los biomas, los pueblos y las entradas
a mazmorras; al entrar en una mazmorra cambia al plano de sus salas y pasillos.
En horizontal, la selección de héroe y los controles se compactan para dejar
más espacio al mundo.

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

En **Celular** aparecen el joystick y los botones de combate durante la partida.
La interfaz se adapta a pantallas horizontales y respeta las áreas seguras del
teléfono; no fuerza el giro del dispositivo. En **PC** se ocultan los controles
táctiles, independientemente del tamaño de la pantalla. Cambiar de modo cancela
cualquier movimiento o pulsación activa.

Antes de comenzar puedes escoger uno de los cinco héroes. Cada clase tiene
distinta apariencia, vida, maná, velocidad, talentos y habilidad. Derrota
enemigos para ganar experiencia, monedas y equipo. Cerca de cada pueblo puedes
aceptar encargos, comprar equipo en la tienda o herrería y reponer pociones en
la alquimia. La estamina disminuye al correr, bloquear y atacar.

El nigromante captura automáticamente el alma del primer enemigo que derrota.
La habilidad la invoca como aliada; solo puede guardar una. Al derrotar a otro
enemigo con el espacio ocupado, el juego pide confirmar antes de reemplazarla.
Las almas y el progreso de esta versión se mantienen solo durante la partida:
no se guardan al recargar la página.

El caballero y el tanque pueden mantener **Q** (o «Bloquear» en celular) para
protegerse con el escudo. Usa **clic izquierdo / J** para combos ligeros,
**clic derecho / K** para golpes pesados y **R** (o «Habilidad» en celular)
para la habilidad de clase. Pulsa **E** o «Interactuar» cerca de un pueblo,
arco de mazmorra o cofre. Acércate al objetivo y míralo para golpearlo.

- **WASD / flechas:** moverse en relación con la cámara.
- **Shift:** mantener para correr.
- **Arrastrar el ratón sobre el mundo:** girar la cámara.
- **R:** habilidad especial de clase.
- **E:** hablar en un pueblo, entrar a una mazmorra o abrir un cofre.
- **Habilidades / Equipo / Misiones:** botones del panel de estado durante la partida.
- **Esc / botón de pausa:** pausar. «Volver al valle» reanuda.
- **Pantalla táctil:** joystick izquierdo para moverse, arrastrar el mundo para
  mirar y mantener «Correr» con otro dedo.

El mundo incluye cinco biomas y pueblos dentro de un mapa ampliado, con límites
físicos. El terreno se carga y libera por bloques cercanos al jugador, con
niebla y distancia de visión limitada. La resolución de renderizado está
limitada a 1,5 veces la resolución CSS para reducir el coste en pantallas de alta
densidad. No se descargan modelos ni texturas externos.
