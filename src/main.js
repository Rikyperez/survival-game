import * as THREE from 'three';
import './style.css';

const world = document.querySelector('#world');
const welcome = document.querySelector('#welcome');
const play = document.querySelector('#play');
const pauseButton = document.querySelector('#pause');
const status = document.querySelector('#status');
const error = document.querySelector('#error');
const deviceMode = document.querySelector('#device-mode');
const heroPicker = document.querySelector('#hero-picker');
const heroHud = document.querySelector('#hero-hud');
const heroCards = document.querySelectorAll('.hero-card');
const heroes = {
  knight: { name: 'Caballero', role: 'GUARDIÁN', health: 120, mana: 70, stamina: 100, walkSpeed: 3.2, runSpeed: 7, outfit: '#8793a0', pants: '#354d49', hair: '#3d3930', shield: true },
  mage: { name: 'Mago', role: 'HECHICERO', health: 80, mana: 140, stamina: 90, walkSpeed: 3.3, runSpeed: 6.8, outfit: '#7965ae', pants: '#39334f', hair: '#342d43' },
  tank: { name: 'Tanque', role: 'DEFENSOR', health: 160, mana: 60, stamina: 110, walkSpeed: 2.8, runSpeed: 5.8, outfit: '#748654', pants: '#394331', hair: '#35382e', shield: true },
  archer: { name: 'Arquero', role: 'EXPLORADOR', health: 95, mana: 85, stamina: 120, walkSpeed: 3.7, runSpeed: 7.8, outfit: '#a87445', pants: '#4d4934', hair: '#43352c' },
  necromancer: { name: 'Nigromante', role: 'SOMBREADOR', health: 90, mana: 130, stamina: 95, walkSpeed: 3.1, runSpeed: 6.6, outfit: '#70556d', pants: '#352e3d', hair: '#292632' },
};
let initialMode = 'mobile';
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
  let selectedHeroId = 'knight';
  let selectedHero = heroes[selectedHeroId];
  let health = selectedHero.health;
  let mana = selectedHero.mana;
  let stamina = selectedHero.stamina;
  let exhausted = false;
  let needsRender = true;

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
  let leftArm;
  let rightArm;
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * .45, 1.64, 0);
    box(arm, .22, .52, .26, outfit, 0, -.23, 0);
    box(arm, .18, .28, .2, skin, 0, -.61, 0);
    body.add(arm);
    if (side < 0) leftArm = arm;
    else rightArm = arm;
    const leg = new THREE.Group();
    leg.position.set(side * .19, 1.02, 0);
    box(leg, .26, .76, .29, pants, 0, -.35, 0);
    box(leg, .28, .19, .41, boots, 0, -.84, -.045);
    body.add(leg);
    limbs.push({ arm, leg, side });
  }
  const equipment = new THREE.Group();
  body.add(equipment);
  const combatGear = [];

  function addEquipment(geometry, material, x, y, z, rotationY = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    equipment.add(mesh);
    return mesh;
  }

  function addCombatGear(parent, geometry, material, x, y, z, rotation = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    mesh.castShadow = true;
    parent.add(mesh);
    combatGear.push(mesh);
    return mesh;
  }

  function selectHero(id) {
    selectedHeroId = id;
    selectedHero = heroes[id];
    health = selectedHero.health;
    mana = selectedHero.mana;
    stamina = selectedHero.stamina;
    exhausted = false;
    outfit.color.set(selectedHero.outfit);
    pants.color.set(selectedHero.pants);
    hair.color.set(selectedHero.hair);
    for (const item of combatGear) {
      item.parent.remove(item);
      item.geometry.dispose();
      if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose());
      else item.material.dispose();
    }
    combatGear.length = 0;
    for (const item of equipment.children) {
      item.geometry.dispose();
      if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose());
      else item.material.dispose();
      item.material.dispose();
    }
    equipment.clear();
    const trim = new THREE.MeshStandardMaterial({ color: selectedHero.outfit, roughness: .8 });
    const metal = new THREE.MeshStandardMaterial({ color: '#c4c7b9', metalness: .55, roughness: .45 });
    const darkLeather = new THREE.MeshStandardMaterial({ color: '#493b2c', roughness: .9 });
    const blade = new THREE.MeshStandardMaterial({ color: '#d7ddd4', metalness: .7, roughness: .3 });
    if (id === 'knight') {
      addEquipment(new THREE.BoxGeometry(.52, .18, .48), metal, 0, 2.37, 0);
      addEquipment(new THREE.BoxGeometry(.12, .22, .13), metal, 0, 2.55, 0);
      addCombatGear(rightArm, new THREE.BoxGeometry(.1, .2, .1), darkLeather, 0, -.73, -.05);
      addCombatGear(rightArm, new THREE.BoxGeometry(.13, .58, .055), blade, 0, -1.08, -.05);
      addCombatGear(rightArm, new THREE.BoxGeometry(.36, .07, .08), metal, 0, -.81, -.05);
      addCombatGear(leftArm, new THREE.BoxGeometry(.43, .52, .12), metal, 0, -.18, -.12);
      addCombatGear(leftArm, new THREE.BoxGeometry(.16, .25, .16), darkLeather, 0, -.18, -.2);
    } else if (id === 'mage') {
      addEquipment(new THREE.ConeGeometry(.34, .62, 5), trim, 0, 2.52, 0);
      addEquipment(new THREE.CylinderGeometry(.34, .34, .06, 8), trim, 0, 2.27, 0);
      addCombatGear(rightArm, new THREE.CylinderGeometry(.035, .045, .95, 6), darkLeather, 0, -.8, -.06);
      addCombatGear(rightArm, new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshStandardMaterial({ color: '#a9c5ff', emissive: '#455d9a' }), 0, -1.3, -.06);
    } else if (id === 'tank') {
      addEquipment(new THREE.BoxGeometry(.4, .36, .44), trim, -.51, 1.69, 0);
      addEquipment(new THREE.BoxGeometry(.4, .36, .44), trim, .51, 1.69, 0);
      addEquipment(new THREE.BoxGeometry(.75, .12, .43), metal, 0, 1.82, 0);
      addCombatGear(rightArm, new THREE.BoxGeometry(.12, .2, .12), darkLeather, 0, -.73, -.05);
      addCombatGear(rightArm, new THREE.CylinderGeometry(.11, .13, .48, 8), metal, 0, -1.08, -.05);
      addCombatGear(leftArm, new THREE.BoxGeometry(.48, .55, .14), trim, 0, -.18, -.12);
      addCombatGear(leftArm, new THREE.BoxGeometry(.18, .25, .18), darkLeather, 0, -.18, -.2);
    } else if (id === 'archer') {
      addEquipment(new THREE.BoxGeometry(.34, .48, .18), trim, 0, 1.5, .31);
      addCombatGear(rightArm, new THREE.TorusGeometry(.45, .025, 5, 16, Math.PI), trim, 0, -.53, -.08, { x: 0, y: 0, z: Math.PI / 2 });
      addCombatGear(rightArm, new THREE.CylinderGeometry(.018, .018, .96, 5), darkLeather, 0, -.53, -.08);
    } else {
      addEquipment(new THREE.ConeGeometry(.35, .57, 5), trim, 0, 2.42, 0);
      addCombatGear(rightArm, new THREE.CylinderGeometry(.035, .05, .95, 6), darkLeather, 0, -.8, -.06);
      addCombatGear(rightArm, new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshStandardMaterial({ color: '#b48bc4', emissive: '#50385e' }), 0, -1.3, -.06);
    }
    document.querySelector('#block').hidden = !selectedHero.shield;
    for (const card of heroCards) {
      const selected = card.dataset.hero === id;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    }
    document.querySelector('#hud-hero-name').textContent = selectedHero.name;
    document.querySelector('#hud-hero-role').textContent = selectedHero.role;
    updateHud(true);
    needsRender = true;
  }

  const healthValue = document.querySelector('#health-value');
  const manaValue = document.querySelector('#mana-value');
  const staminaValue = document.querySelector('#stamina-value');
  const healthBar = document.querySelector('#health-bar');
  const manaBar = document.querySelector('#mana-bar');
  const staminaBar = document.querySelector('#stamina-bar');
  const healthTrack = document.querySelector('#health-track');
  const manaTrack = document.querySelector('#mana-track');
  const staminaTrack = document.querySelector('#stamina-track');
  function updateHud() {
    healthValue.textContent = `${Math.ceil(health)} / ${selectedHero.health}`;
    manaValue.textContent = `${Math.ceil(mana)} / ${selectedHero.mana}`;
    staminaValue.textContent = `${Math.ceil(stamina)} / ${selectedHero.stamina}`;
    healthBar.style.width = `${health / selectedHero.health * 100}%`;
    manaBar.style.width = `${mana / selectedHero.mana * 100}%`;
    staminaBar.style.width = `${stamina / selectedHero.stamina * 100}%`;
    healthTrack.setAttribute('aria-valuemax', String(selectedHero.health));
    manaTrack.setAttribute('aria-valuemax', String(selectedHero.mana));
    staminaTrack.setAttribute('aria-valuemax', String(selectedHero.stamina));
    healthTrack.setAttribute('aria-valuenow', String(Math.ceil(health)));
    manaTrack.setAttribute('aria-valuenow', String(Math.ceil(mana)));
    staminaTrack.setAttribute('aria-valuenow', String(Math.ceil(stamina)));
  }
  heroCards.forEach((card) => card.addEventListener('click', () => {
    if (!playing && heroPicker.hidden === false) selectHero(card.dataset.hero);
  }));
  selectHero(selectedHeroId);

  const trainingDummy = new THREE.Group();
  const dummyWood = new THREE.MeshStandardMaterial({ color: '#85643d', roughness: .9 });
  const dummyDark = new THREE.MeshStandardMaterial({ color: '#4d3b2b', roughness: .95 });
  const dummyTarget = new THREE.MeshStandardMaterial({ color: '#c88d5b', roughness: .85 });
  const dummyBase = new THREE.MeshStandardMaterial({ color: '#66523a', roughness: 1 });
  box(trainingDummy, .17, 1.8, .17, dummyWood, 0, .9, 0);
  box(trainingDummy, 1.12, .14, .14, dummyWood, 0, 1.72, 0);
  const dummyHead = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), dummyTarget);
  dummyHead.position.set(0, 1.35, 0);
  dummyHead.castShadow = true;
  trainingDummy.add(dummyHead);
  box(trainingDummy, .52, .16, .08, dummyDark, 0, 1.34, -.29);
  box(trainingDummy, .72, .16, .12, dummyTarget, 0, .98, -.12);
  box(trainingDummy, .2, .22, .2, dummyDark, 0, -.06, 0);
  const dummyBaseMesh = new THREE.Mesh(new THREE.CylinderGeometry(.63, .78, .16, 8), dummyBase);
  dummyBaseMesh.position.y = -.16;
  dummyBaseMesh.receiveShadow = true;
  trainingDummy.add(dummyBaseMesh);
  trainingDummy.position.set(-.6, heightAt(-.6, -21.2), -21.2);
  scene.add(trainingDummy);
  const trainingMaxHealth = 2400;
  let trainingHealth = trainingMaxHealth;
  let lastTrainingHit = -Infinity;
  let dummyHitFlash = 0;
  const trainingHud = document.querySelector('#training-hud');
  const trainingHealthValue = document.querySelector('#training-health-value');
  const trainingHealthBar = document.querySelector('#training-health-bar');
  const trainingHealthTrack = document.querySelector('#training-health-track');
  const combatFeedback = document.querySelector('#combat-feedback');

  function updateTrainingHud() {
    trainingHealthValue.textContent = `${Math.ceil(trainingHealth)} / ${trainingMaxHealth}`;
    trainingHealthBar.style.width = `${trainingHealth / trainingMaxHealth * 100}%`;
    trainingHealthTrack.setAttribute('aria-valuenow', String(Math.ceil(trainingHealth)));
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
  let attack = null;
  let lightCombo = 0;
  let heavyCombo = 0;
  let lastLightAttack = -Infinity;
  let lastHeavyAttack = -Infinity;
  let blockHeld = false;
  let combatFeedbackTime = 0;
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
    blockHeld = false;
    attack = null;
    stick.style.transform = '';
  }
  function setCombatFeedback(message, duration = 1) {
    combatFeedback.textContent = message;
    combatFeedbackTime = duration;
    needsRender = true;
  }
  function damageTrainingDummy(amount) {
    const toDummy = new THREE.Vector3(
      trainingDummy.position.x - player.position.x,
      0,
      trainingDummy.position.z - player.position.z,
    );
    const distance = toDummy.length();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    if (distance > 3.35 || forward.dot(toDummy.normalize()) < .18) {
      setCombatFeedback('Acércate y mira al maniquí', 1.2);
      return;
    }
    trainingHealth = Math.max(0, trainingHealth - amount);
    lastTrainingHit = performance.now() / 1000;
    dummyHitFlash = .2;
    dummyTarget.color.set('#ffb08c');
    updateTrainingHud();
    setCombatFeedback(`¡Impacto! −${amount}`, .8);
  }
  function startAttack(type) {
    if (!playing || blockHeld) return;
    if (attack && attack.elapsed < attack.duration * .62) return;
    const now = performance.now() / 1000;
    const heavy = type === 'heavy';
    const cost = heavy ? 18 : 8;
    if (stamina < cost) {
      setCombatFeedback('No tienes estamina suficiente', 1);
      return;
    }
    stamina -= cost;
    updateHud();
    if (heavy) {
      heavyCombo = now - lastHeavyAttack < 1.15 ? heavyCombo % 2 + 1 : 1;
      lastHeavyAttack = now;
      attack = { type, combo: heavyCombo, elapsed: 0, duration: .92, hit: false };
    } else {
      lightCombo = now - lastLightAttack < 1.1 ? lightCombo % 3 + 1 : 1;
      lastLightAttack = now;
      attack = { type, combo: lightCombo, elapsed: 0, duration: .58, hit: false };
    }
    setCombatFeedback(heavy ? `Golpe pesado ${heavyCombo}/2` : `Combo ligero ${lightCombo}/3`, .65);
  }
  function startBlock() {
    if (!playing || !selectedHero.shield || stamina <= 0 || attack) return;
    blockHeld = true;
    setCombatFeedback('Bloqueando con escudo', .6);
  }
  function stopBlock() {
    blockHeld = false;
  }
  const attackLightButton = document.querySelector('#attack-light');
  const attackHeavyButton = document.querySelector('#attack-heavy');
  const blockButton = document.querySelector('#block');
  attackLightButton.addEventListener('click', (event) => {
    if (deviceMode.value !== 'mobile') return;
    event.preventDefault();
    startAttack('light');
  });
  attackHeavyButton.addEventListener('click', (event) => {
    if (deviceMode.value !== 'mobile') return;
    event.preventDefault();
    startAttack('heavy');
  });
  blockButton.addEventListener('pointerdown', (event) => {
    if (deviceMode.value !== 'mobile') return;
    event.preventDefault();
    blockButton.setPointerCapture(event.pointerId);
    startBlock();
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    blockButton.addEventListener(event, stopBlock);
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
    heroPicker.hidden = false;
    heroHud.hidden = true;
    trainingHud.hidden = true;
    pauseButton.hidden = true;
    world.classList.remove('playing');
    status.textContent = 'EN PAUSA';
    play.innerHTML = 'Volver al valle <span aria-hidden="true">↗</span>';
    play.focus();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  play.addEventListener('click', () => {
    playing = true;
    heroPicker.hidden = true;
    welcome.hidden = true;
    heroHud.hidden = false;
    pauseButton.hidden = false;
    world.classList.add('playing');
    status.textContent = 'EXPLORANDO';
    play.innerHTML = 'Volver al valle <span aria-hidden="true">↗</span>';
    play.blur();
    trainingHud.hidden = false;
  });
  pauseButton.addEventListener('click', pause);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && playing) pause();
    if (!playing || event.target === deviceMode) return;
    if (event.code === 'KeyJ') {
      event.preventDefault();
      startAttack('light');
      return;
    }
    if (event.code === 'KeyK') {
      event.preventDefault();
      startAttack('heavy');
      return;
    }
    if (event.code === 'KeyQ' || event.code === 'Space') {
      event.preventDefault();
      startBlock();
      return;
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (event.code === 'KeyQ' || event.code === 'Space') stopBlock();
  });
  window.addEventListener('blur', () => { if (playing) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!playing) return;
    if (deviceMode.value === 'pc' && event.button === 0) startAttack('light');
    if (deviceMode.value === 'pc' && event.button === 2) {
      event.preventDefault();
      startAttack('heavy');
    }
    if (lookPointer !== null || event.button !== 0) return;
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
      if (blockHeld && (!selectedHero.shield || stamina <= 0)) stopBlock();
      const blocking = blockHeld && selectedHero.shield && stamina > 0;
      const wantsRun = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchRun;
      const running = wantsRun && !blocking && !exhausted && stamina > 0;
      const previousStamina = Math.ceil(stamina);
      if (blocking) {
        stamina = Math.max(0, stamina - 16 * dt);
        if (stamina === 0) stopBlock();
      } else if (running && strength > 0) {
        stamina = Math.max(0, stamina - 24 * dt);
        if (stamina === 0) exhausted = true;
      } else if (!attack) {
        stamina = Math.min(selectedHero.stamina, stamina + 18 * dt);
        if (stamina >= selectedHero.stamina * .35) exhausted = false;
      }
      if (Math.ceil(stamina) !== previousStamina) updateHud();
      const desiredSpeed = move.lengthSq() > 0
        ? (blocking ? selectedHero.walkSpeed * .45 : running ? selectedHero.runSpeed : selectedHero.walkSpeed) * strength
        : 0;
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
      let attackProgress = 0;
      let attackPose = 0;
      let attackTwist = 0;
      if (attack) {
        attack.elapsed += dt;
        attackProgress = Math.min(1, attack.elapsed / attack.duration);
        const windup = 1 - THREE.MathUtils.smoothstep(attackProgress, 0, .3);
        const strike = Math.sin(Math.PI * THREE.MathUtils.clamp((attackProgress - .18) / .56, 0, 1));
        attackPose = attack.type === 'heavy' ? 2.9 * strike - .82 * windup : 2.3 * strike - .48 * windup;
        attackTwist = (attack.combo % 2 ? 1 : -1) * strike * (attack.type === 'heavy' ? .55 : .32);
        if (!attack.hit && attackProgress >= .3) {
          attack.hit = true;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
          player.position.addScaledVector(forward, attack.type === 'heavy' ? .42 : .22);
          player.position.x = THREE.MathUtils.clamp(player.position.x, -playerLimit, playerLimit);
          player.position.z = THREE.MathUtils.clamp(player.position.z, -playerLimit, playerLimit);
          player.position.y = heightAt(player.position.x, player.position.z);
          damageTrainingDummy(attack.type === 'heavy' ? 58 + attack.combo * 16 : 24 + attack.combo * 12);
        }
        if (attackProgress >= 1) attack = null;
      }
      if (dummyHitFlash > 0) {
        dummyHitFlash = Math.max(0, dummyHitFlash - dt);
        trainingDummy.rotation.z = THREE.MathUtils.damp(trainingDummy.rotation.z, dummyHitFlash > 0 ? .09 : 0, 12, dt);
        if (dummyHitFlash === 0) dummyTarget.color.set('#c88d5b');
      } else {
        trainingDummy.rotation.z = THREE.MathUtils.damp(trainingDummy.rotation.z, 0, 12, dt);
      }
      const gameTime = performance.now() / 1000;
      if (gameTime - lastTrainingHit > 1.25 && trainingHealth < trainingMaxHealth) {
        trainingHealth = Math.min(trainingMaxHealth, trainingHealth + (trainingHealth === 0 ? 120 : 70) * dt);
        updateTrainingHud();
      }
      if (combatFeedbackTime > 0) {
        combatFeedbackTime = Math.max(0, combatFeedbackTime - dt);
        if (combatFeedbackTime === 0) combatFeedback.textContent = '';
      }
      for (const { arm, leg, side } of limbs) {
        arm.rotation.x = swing * side
          + (side > 0 ? attackPose : blocking ? 1.05 : 0);
        arm.rotation.z = side > 0 ? attackTwist : blocking ? -.28 : 0;
        leg.rotation.x = -swing * side;
      }
      body.position.y = Math.abs(Math.sin(gait)) * .055 * Math.min(speed / 3.2, 1);
      body.position.z = -Math.max(0, attackPose) * .07;
      body.rotation.y = attackTwist * .45;
      updateChunks(player.position.x, player.position.z);
      updateCamera(dt);
      sun.position.set(player.position.x - 35, player.position.y + 55, player.position.z + 30);
      sun.target.position.copy(player.position);
    }
    renderer.render(scene, camera);
    needsRender = false;
  });
}
