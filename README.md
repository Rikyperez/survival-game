# Pradera — survival-game

Base de un juego 3D en tercera persona con Three.js: valle de pasto, montañas
que delimitan el mundo y un personaje articulado que camina y corre.
Sin combate, inventario ni objetivos por ahora.

## Ejecutar

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
