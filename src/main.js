import * as THREE from 'three';
import './style.css';

const world = document.querySelector('#world');
const welcome = document.querySelector('#welcome');
const play = document.querySelector('#play');
const pauseButton = document.querySelector('#pause');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const deviceMode = document.querySelector('#device-mode');
let initialMode = window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'pc';
try {
  const savedMode = localStorage.getItem('pradera-device-mode');
  if (savedMode === 'pc' || savedMode === 'mobile') initialMode = savedMode;
} catch {
  // The selector still works when browser storage is unavailable.
}
deviceMode.value = initialMode;
document.documentElement.dataset.device = initialMode;
deviceMode.addEventListener('change', () => {
  document.documentElement.dataset.device = deviceMode.value;
  try {
    localStorage.setItem('pradera-device-mode', deviceMode.value);
  } catch {
    // Saving the preference is optional.
  }
});

try {
  startGame();
} catch (cause) {
  error.hidden = false;
  error.textContent = 'No se pudo iniciar el mundo 3D. Comprueba que tu navegador admita WebGL 2 y tenga la aceleración gráfica activada. Recarga la página para volver a intentar.';
  play.disabled = true;
  console.error(cause);
}

function startGame() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bedcde');
  scene.fog = new THREE.Fog('#bedcde', 42, 89);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(scene.background);
  world.prepend(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 130);
  scene.add(new THREE.HemisphereLight('#e5f3f5', '#63753b', 2.3));
  const sun = new THREE.DirectionalLight('#fff0cb', 3);
  sun.position.set(-35, 55, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 110 });
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  const chunkSize = 24;
  const chunkRadius = 4;
  const worldLimit = 120;
  const playerLimit = 111;
  const chunks = new Map();
  const groundMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const grassMaterial = new THREE.MeshStandardMaterial({ color: '#78943c', roughness: 1, side: THREE.DoubleSide });
  const grassGeometry = new THREE.BufferGeometry();
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.12, 0, 0, .12, 0, 0, .025, .48, 0,
    0, 0, -.12, 0, 0, .12, 0, .36, .03,
  ], 3));
  grassGeometry.computeVertexNormals();
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const meadow = new THREE.Color('#829f4b');
  const slope = new THREE.Color('#667e43');
  const rock = new THREE.Color('#8a9385');

  function heightAt(x, z) {
    const rolling = Math.sin(x * .045) * Math.cos(z * .038) * 1.5
      + Math.sin(x * .11 + z * .07) * .35;
    const edge = THREE.MathUtils.smoothstep(Math.max(Math.abs(x), Math.abs(z)), 76, worldLimit);
    const peaks = 21 + 9 * Math.sin(x * .095 + z * .065) + 6 * Math.cos(z * .14 - x * .06);
    return rolling + edge * peaks;
  }

  function createChunk(cx, cz) {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(chunkSize, chunkSize, 12, 12);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    const colors = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i) + cx * chunkSize;
      const z = positions.getZ(i) + cz * chunkSize;
      const height = heightAt(x, z);
      positions.setY(i, height);
      color.copy(meadow).lerp(slope, THREE.MathUtils.smoothstep(height, 1, 10));
      color.lerp(rock, THREE.MathUtils.smoothstep(height, 8, 24));
      color.multiplyScalar(.96 + .04 * Math.sin(x * .8 + z * .7));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const ground = new THREE.Mesh(geometry, groundMaterial);
    ground.receiveShadow = true;
    group.add(ground);
    const grass = new THREE.InstancedMesh(grassGeometry, grassMaterial, 100);
    let count = 0;
    for (let i = 0; i < 100; i++) {
      const localX = (Math.sin(i * 127.1 + cx * 311.7 + cz * 74.7) * 43758.5453 % 1) * 11.5;
      const localZ = (Math.sin(i * 269.5 + cx * 183.3 + cz * 246.1) * 22578.1459 % 1) * 11.5;
      const x = localX + cx * chunkSize;
      const z = localZ + cz * chunkSize;
      if (Math.max(Math.abs(x), Math.abs(z)) > 79) continue;
      dummy.position.set(localX, heightAt(x, z) - .08, localZ);
      dummy.rotation.y = i * 2.4;
      dummy.scale.setScalar(.6 + (i % 5) * .16);
      dummy.updateMatrix();
      grass.setMatrixAt(count++, dummy.matrix);
    }
    grass.count = count;
    grass.instanceMatrix.needsUpdate = true;
    group.add(grass);
    group.position.set(cx * chunkSize, 0, cz * chunkSize);
    scene.add(group);
    return group;
  }

  let previousChunk = '';
  function updateChunks(x, z) {
    const cx = Math.floor((x + chunkSize / 2) / chunkSize);
    const cz = Math.floor((z + chunkSize / 2) / chunkSize);
    const center = `${cx},${cz}`;
    if (previousChunk === center) return;
    previousChunk = center;
    const needed = new Set();
    for (let dx = -chunkRadius; dx <= chunkRadius; dx++) {
      for (let dz = -chunkRadius; dz <= chunkRadius; dz++) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (Math.abs(nx * chunkSize) > worldLimit || Math.abs(nz * chunkSize) > worldLimit) continue;
        const key = `${nx},${nz}`;
        needed.add(key);
        if (!chunks.has(key)) chunks.set(key, createChunk(nx, nz));
      }
    }
    for (const [key, chunk] of chunks) {
      if (needed.has(key)) continue;
      scene.remove(chunk);
      chunk.children[0].geometry.dispose();
      chunk.children[1].dispose();
      chunks.delete(key);
    }
    document.querySelector('#chunk-count').textContent = chunks.size;
  }

  const player = new THREE.Group();
  scene.add(player);
  player.position.set(0, heightAt(0, -18), -18);
  const outfit = new THREE.MeshStandardMaterial({ color: '#c4aa72', roughness: .95 });
  const pants = new THREE.MeshStandardMaterial({ color: '#354d49', roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: '#d9ac84', roughness: 1 });
  const boots = new THREE.MeshStandardMaterial({ color: '#33413b', roughness: 1 });
  const hair = new THREE.MeshStandardMaterial({ color: '#3d3930', roughness: 1 });

  function box(parent, width, height, depth, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const body = new THREE.Group();
  player.add(body);
  box(body, .65, .78, .36, outfit, 0, 1.35, 0);
  box(body, .22, .16, .22, skin, 0, 1.8, 0);
  box(body, .43, .46, .42, skin, 0, 2.08, 0);
  box(body, .45, .16, .44, hair, 0, 2.29, .01);
  box(body, .44, .25, .1, hair, 0, 2.13, .19);
  // The character faces local -Z, matching the camera's forward direction.
  box(body, .065, .055, .025, hair, -.11, 2.09, -.216);
  box(body, .065, .055, .025, hair, .11, 2.09, -.216);
  box(body, .45, .51, .2, pants, 0, 1.41, .26);
  const limbs = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * .45, 1.64, 0);
    box(arm, .22, .52, .26, outfit, 0, -.23, 0);
    box(arm, .18, .28, .2, skin, 0, -.61, 0);
    body.add(arm);
    const leg = new THREE.Group();
    leg.position.set(side * .19, 1.02, 0);
    box(leg, .26, .76, .29, pants, 0, -.35, 0);
    box(leg, .28, .19, .41, boots, 0, -.84, -.045);
    body.add(leg);
    limbs.push({ arm, leg, side });
  }

  const keys = new Set();
  const move = new THREE.Vector3();
  const target = new THREE.Vector3();
  const cameraGoal = new THREE.Vector3();
  const look = new THREE.Vector3();
  let yaw = -.3;
  let pitch = .29;
  let playing = false;
  let speed = 0;
  let gait = 0;
  let touchRun = false;
  let joystickPointer = null;
  let lookPointer = null;
  let pointerX = 0;
  let pointerY = 0;
  let joystickX = 0;
  let joystickY = 0;
  const joystick = document.querySelector('#joystick');
  const stick = document.querySelector('#stick');
  const run = document.querySelector('#run');

  function resetInput() {
    keys.clear();
    joystickX = joystickY = 0;
    joystickPointer = lookPointer = null;
    touchRun = false;
    stick.style.transform = '';
  }
  deviceMode.addEventListener('change', () => {
    resetInput();
    speed = 0;
    resize();
    deviceMode.blur();
  });
  function pause() {
    playing = false;
    resetInput();
    welcome.hidden = false;
    pauseButton.hidden = true;
    world.classList.remove('playing');
    status.textContent = 'EN PAUSA';
    play.innerHTML = 'Volver al valle <span aria-hidden="true">↗</span>';
    play.focus();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  play.addEventListener('click', () => {
    playing = true;
    welcome.hidden = true;
    pauseButton.hidden = false;
    world.classList.add('playing');
    status.textContent = 'EXPLORANDO';
    play.blur();
  });
  pauseButton.addEventListener('click', pause);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && playing) pause();
    if (!playing || event.target === deviceMode) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { if (playing) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!playing || lookPointer !== null || event.button !== 0) return;
    lookPointer = event.pointerId;
    pointerX = event.clientX;
    pointerY = event.clientY;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!playing || event.pointerId !== lookPointer) return;
    yaw -= (event.clientX - pointerX) * .005;
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - pointerY) * .004, -.12, .95);
    pointerX = event.clientX;
    pointerY = event.clientY;
  });
  function stopLook(event) {
    if (event.pointerId === lookPointer) lookPointer = null;
  }
  renderer.domElement.addEventListener('pointerup', stopLook);
  renderer.domElement.addEventListener('pointercancel', stopLook);
  renderer.domElement.addEventListener('lostpointercapture', stopLook);
  renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

  function updateJoystick(event) {
    const rect = joystick.getBoundingClientRect();
    let x = (event.clientX - rect.left - rect.width / 2) / 38;
    let y = (event.clientY - rect.top - rect.height / 2) / 38;
    const length = Math.max(1, Math.hypot(x, y));
    x /= length;
    y /= length;
    joystickX = x;
    joystickY = y;
    stick.style.transform = `translate(${x * 32}px, ${y * 32}px)`;
  }
  joystick.addEventListener('pointerdown', (event) => {
    if (!playing || deviceMode.value !== 'mobile' || joystickPointer !== null) return;
    joystickPointer = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    updateJoystick(event);
  });
  joystick.addEventListener('pointermove', (event) => {
    if (event.pointerId === joystickPointer) updateJoystick(event);
  });
  function stopJoystick(event) {
    if (event.pointerId !== joystickPointer) return;
    joystickPointer = null;
    joystickX = joystickY = 0;
    stick.style.transform = '';
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(event, stopJoystick);
  run.addEventListener('pointerdown', (event) => {
    if (!playing || deviceMode.value !== 'mobile') return;
    touchRun = true;
    run.setPointerCapture(event.pointerId);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) run.addEventListener(event, () => { touchRun = false; });

  function updateCamera(dt, snap = false) {
    target.copy(player.position);
    target.y += 1.55;
    const distance = 6.8;
    cameraGoal.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    // Sample the boom so hills cannot hide the player or cut through the camera.
    for (let i = 1; i <= 16; i++) {
      look.lerpVectors(target, cameraGoal, i / 16);
      const clearance = heightAt(look.x, look.z) + .55;
      if (look.y < clearance) cameraGoal.y += (clearance - look.y) / (i / 16);
    }
    camera.position.lerp(cameraGoal, snap ? 1 : 1 - Math.exp(-12 * dt));
    camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + .55);
    camera.lookAt(target);
    const compass = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const degrees = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    document.querySelector('#heading').textContent = compass[Math.round(degrees / 45) % 8];
  }

  let needsRender = true;
  function resize() {
    renderer.setSize(world.clientWidth, world.clientHeight);
    camera.aspect = world.clientWidth / Math.max(1, world.clientHeight);
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  window.addEventListener('resize', resize);
  resize();
  updateChunks(player.position.x, player.position.z);
  updateCamera(0, true);
  let lastTime = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - lastTime) / 1000, .05);
    lastTime = now;
    if (!playing && !needsRender) return;
    if (playing) {
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - joystickY;
      const sideways = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + joystickX;
      move.set(sideways, 0, -forward);
      const strength = Math.min(1, move.length());
      if (strength > .08) move.normalize();
      else move.set(0, 0, 0);
      move.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      const running = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchRun;
      const desiredSpeed = move.lengthSq() > 0 ? (running ? 7 : 3.2) * strength : 0;
      speed = THREE.MathUtils.damp(speed, desiredSpeed, 12, dt);
      player.position.addScaledVector(move, speed * dt);
      player.position.x = THREE.MathUtils.clamp(player.position.x, -playerLimit, playerLimit);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -playerLimit, playerLimit);
      player.position.y = heightAt(player.position.x, player.position.z);
      if (move.lengthSq() > 0) {
        const facing = Math.atan2(-move.x, -move.z);
        player.rotation.y += Math.atan2(Math.sin(facing - player.rotation.y), Math.cos(facing - player.rotation.y)) * (1 - Math.exp(-14 * dt));
      }
      gait += speed * dt * 2.5;
      const swing = Math.sin(gait) * Math.min(speed / 7, 1) * .9;
      for (const { arm, leg, side } of limbs) {
        arm.rotation.x = swing * side;
        leg.rotation.x = -swing * side;
      }
      body.position.y = Math.abs(Math.sin(gait)) * .055 * Math.min(speed / 3.2, 1);
      updateChunks(player.position.x, player.position.z);
      updateCamera(dt);
      sun.position.set(player.position.x - 35, player.position.y + 55, player.position.z + 30);
      sun.target.position.copy(player.position);
    }
    renderer.render(scene, camera);
    needsRender = false;
  });
}
