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
const zoneAbilityNames = { knight: 'EMBESTIDA', mage: 'RAYO ARCANO', tank: 'GOLPE SÍSMICO', archer: 'LLUVIA DE FLECHAS', necromancer: 'INVOCAR ALMA' };
const bossCooldownMs = 12 * 60 * 60 * 1000;
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
  scene.fog = new THREE.Fog('#bedcde', 48, 82);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(scene.background);
  world.prepend(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 175);
  scene.add(new THREE.HemisphereLight('#e5f3f5', '#63753b', 2.3));
  const sun = new THREE.DirectionalLight('#fff0cb', 3);
  sun.position.set(-35, 55, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 110 });
  sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);

  const chunkSize = 24;
  const chunkRadius = 3;
  const worldLimit = 216;
  const playerLimit = 205;
  const chunks = new Map();
  let activeDungeon = null;
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
  const zones = [
    { id: 'meadow', name: 'Valle de Bruma', kind: 'PRADERA', description: 'Un refugio tranquilo al borde de la frontera.', x: 0, z: -18, townX: -26, townZ: -50, entranceX: 38, entranceZ: -38, dungeon: 'Cripta de las Raíces', dungeonBoss: 'Rey Raíz', bossKey: 'crypt', ground: '#829f4b', slope: '#667e43', rock: '#8a9385', tree: '#497244', accent: '#a7b86d', town: 'Lindeverde' },
    { id: 'forest', name: 'Bosque de los Susurros', kind: 'BOSQUE ANTIGUO', description: 'Sombras densas y criaturas entre los árboles.', x: 92, z: 52, townX: 92, townZ: 52, entranceX: 138, entranceZ: 44, dungeon: 'Santuario del Bosque Hueco', dungeonBoss: 'Madre de Espinas', bossKey: 'sanctuary', ground: '#527447', slope: '#3e5b3e', rock: '#777c64', tree: '#345d3b', accent: '#9ab66b', town: 'Raízalta' },
    { id: 'frost', name: 'Cumbres de Escarcha', kind: 'TIERRAS HELADAS', description: 'Nieve, ruinas y bestias endurecidas por el frío.', x: -92, z: 72, townX: -92, townZ: 72, entranceX: -138, entranceZ: 68, dungeon: 'Bastión del Hielo Eterno', dungeonBoss: 'Titán Glacial', bossKey: 'bastion', ground: '#b3c5bf', slope: '#7c9999', rock: '#8f9e9c', tree: '#54756e', accent: '#e1e9d8', town: 'Ventisca' },
    { id: 'ash', name: 'Yermos Cenicientos', kind: 'TIERRAS VOLCÁNICAS', description: 'Tierra quemada, metales raros y enemigos fuertes.', x: 94, z: -102, townX: 94, townZ: -102, entranceX: 142, entranceZ: -116, dungeon: 'Foso de la Llama Negra', dungeonBoss: 'Dragón de Ceniza', bossKey: 'forge', ground: '#80645a', slope: '#604d48', rock: '#9a7460', tree: '#55433d', accent: '#d38c57', town: 'Brasal' },
    { id: 'sand', name: 'Mar de Dunas', kind: 'DESIERTO', description: 'Dunas abiertas y saqueadores al acecho.', x: -105, z: -104, townX: -105, townZ: -104, entranceX: -150, entranceZ: -112, dungeon: 'Palacio Sepultado', dungeonBoss: 'Faraón de Arena', bossKey: 'palace', ground: '#c4a46a', slope: '#9c8052', rock: '#d4bd87', tree: '#687044', accent: '#e2c47a', town: 'Pozo del Sol' },
  ];
  const zoneColors = new Map(zones.map((zone) => [zone.id, {
    ground: new THREE.Color(zone.ground),
    slope: new THREE.Color(zone.slope),
    rock: new THREE.Color(zone.rock),
  }]));
  const zoneAt = (x, z) => zones.reduce((closest, zone) =>
    Math.hypot(x - zone.x, z - zone.z) < Math.hypot(x - closest.x, z - closest.z) ? zone : closest, zones[0]);
  const treeMaterials = new Map(zones.map((zone) => [zone.id, new THREE.MeshStandardMaterial({ color: zone.tree, roughness: 1 })]));
  const townWallMaterials = new Map(zones.map((zone) => [zone.id, new THREE.MeshStandardMaterial({ color: zone.accent, roughness: 1 })]));
  const roofMaterial = new THREE.MeshStandardMaterial({ color: '#674d3d', roughness: 1 });
  const houseGeometry = new THREE.BoxGeometry(3.2, 2, 2.7);
  const roofGeometry = new THREE.ConeGeometry(2.45, 1.55, 4);
  const doorGeometry = new THREE.BoxGeometry(.55, 1.15, .08);
  const doorMaterial = new THREE.MeshStandardMaterial({ color: '#493b2c', roughness: 1 });
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#594731', roughness: 1 });
  const trunkGeometry = new THREE.CylinderGeometry(.13, .22, 1.65, 5);
  const canopyGeometry = new THREE.ConeGeometry(.85, 2.25, 6);
  const stoneGeometry = new THREE.DodecahedronGeometry(.52, 0);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#82867a', roughness: 1 });

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
      const palette = zoneColors.get(zoneAt(x, z).id);
      color.copy(palette.ground).lerp(palette.slope, THREE.MathUtils.smoothstep(height, 1, 10));
      color.lerp(palette.rock, THREE.MathUtils.smoothstep(height, 8, 24));
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
    const details = new THREE.Group();
    const zone = zoneAt(cx * chunkSize, cz * chunkSize);
    const treeMaterial = treeMaterials.get(zone.id);
    for (let i = 0; i < (zone.id === 'sand' ? 1 : 5); i++) {
      const seed = i + cx * 71 + cz * 113;
      const localX = (Math.abs(Math.sin(seed * 127.1) * 43758.5453) % 1) * (chunkSize - 2) - chunkSize / 2 + 1;
      const localZ = (Math.abs(Math.sin(seed * 269.5) * 22578.1459) % 1) * (chunkSize - 2) - chunkSize / 2 + 1;
      const x = localX + cx * chunkSize;
      const z = localZ + cz * chunkSize;
      if (Math.max(Math.abs(x), Math.abs(z)) > playerLimit - 10) continue;
      if (zones.some((settlement) => Math.hypot(x - settlement.x, z - settlement.z) < 17)) continue;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = .8;
      const canopy = new THREE.Mesh(canopyGeometry, treeMaterial);
      canopy.position.y = 2.15;
      tree.add(trunk, canopy);
      tree.position.set(localX, heightAt(x, z), localZ);
      tree.rotation.y = seed;
      tree.scale.setScalar(.78 + (i % 3) * .16);
      trunk.castShadow = canopy.castShadow = true;
      details.add(tree);
    }
    for (let i = 0; i < 3; i++) {
      const seed = i + cx * 97 + cz * 139 + 17;
      const localX = (Math.abs(Math.sin(seed * 73.1) * 24634.6345) % 1) * 20 - 10;
      const localZ = (Math.abs(Math.sin(seed * 39.7) * 12345.6789) % 1) * 20 - 10;
      const x = localX + cx * chunkSize;
      const z = localZ + cz * chunkSize;
      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
      stone.position.set(localX, heightAt(x, z) + .25, localZ);
      stone.scale.set(.7 + i * .12, .65 + i * .1, .6 + i * .08);
      stone.rotation.set(seed * .1, seed, seed * .04);
      stone.castShadow = true;
      details.add(stone);
    }
    const townZone = zones.find((settlement) =>
      Math.floor((settlement.townX + chunkSize / 2) / chunkSize) === cx
      && Math.floor((settlement.townZ + chunkSize / 2) / chunkSize) === cz);
    if (townZone) {
      const walls = townWallMaterials.get(townZone.id);
      for (const [offsetX, offsetZ, rotation] of [[-5, -5, .15], [5, -4, -.22], [0, 5, .35]]) {
        const house = new THREE.Group();
        const wallsMesh = new THREE.Mesh(houseGeometry, walls);
        wallsMesh.position.y = 1;
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 2.65;
        roof.rotation.y = Math.PI / 4;
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, .56, -1.38);
        house.add(wallsMesh, roof, door);
        house.position.set(townZone.townX - cx * chunkSize + offsetX, heightAt(townZone.townX + offsetX, townZone.townZ + offsetZ), townZone.townZ - cz * chunkSize + offsetZ);
        house.rotation.y = rotation;
        wallsMesh.castShadow = roof.castShadow = true;
        details.add(house);
      }
    }
    group.add(details);
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
  let experience = 0;
  let level = 1;
  let skillPoints = 0;
  let coins = 0;
  const unlockedSkills = new Set();
  const inventory = [];
  let equippedItem = null;
  let activeQuest = null;
  const rarityOrder = ['Común', 'Poco común', 'Raro', 'Épico', 'Legendario', 'Mítico'];
  const rarityColors = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'legendary'];
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
    document.querySelector('#ability').textContent = zoneAbilityNames[id] || 'HABILIDAD';
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
  const levelValue = document.querySelector('#level-value');
  const coinValue = document.querySelector('#coin-value');
  const adventurePanel = document.querySelector('#adventure-panel');
  const panelTitle = document.querySelector('#panel-title');
  const panelEyebrow = document.querySelector('#panel-eyebrow');
  const panelContent = document.querySelector('#panel-content');
  const panelClose = document.querySelector('#panel-close');
  const zoneEyebrow = document.querySelector('#zone-eyebrow');
  const zoneName = document.querySelector('#zone-name');
  const zoneDescription = document.querySelector('#zone-description');
  let panelMode = '';
  let currentZone = zoneAt(player.position.x, player.position.z);
  let nearbyTown = null;
  let nearbyEntrance = null;
  let nearbyTreasure = null;
  const dungeonHud = document.querySelector('#dungeon-hud');
  const dungeonTitle = document.querySelector('#dungeon-title');
  const dungeonBossStatus = document.querySelector('#dungeon-boss-status');
  const dungeonBossTrack = document.querySelector('#dungeon-boss-track');
  const dungeonBossBar = document.querySelector('#dungeon-boss-bar');
  const leaveDungeonButton = document.querySelector('#leave-dungeon');
  const skillCatalog = {
    knight: [['blade', 'Filo veterano', 'Aumenta el daño de armas un 20%.'], ['guard', 'Guardia férrea', 'Reduce el daño recibido un 15%.'], ['valor', 'Segundo aliento', 'Recupera estamina un 25% más rápido.']],
    mage: [['spark', 'Chispa arcana', 'Los hechizos infligen un 25% más de daño.'], ['focus', 'Mente serena', 'Las habilidades cuestan 20% menos maná.'], ['surge', 'Sobrecarga', 'Dispara un segundo proyectil mágico.']],
    tank: [['bastion', 'Bastión', 'Reduce el daño recibido un 25%.'], ['slam', 'Golpe sísmico', 'Los ataques pesados infligen 30% más daño.'], ['resolve', 'Voluntad de hierro', 'Aumenta la vida máxima en 20%.']],
    archer: [['aim', 'Puntería precisa', 'Los ataques infligen un 25% más de daño.'], ['quickstep', 'Paso ligero', 'Aumenta la velocidad de movimiento un 12%.'], ['volley', 'Lluvia de flechas', 'La habilidad golpea dos veces.']],
    necromancer: [['harvest', 'Cosecha oscura', 'Los ataques mágicos infligen 25% más daño.'], ['bond', 'Vínculo impío', 'Tu invocación aguanta más daño.'], ['echo', 'Eco de almas', 'Las almas capturadas conservan 20% más de poder.']],
  };
  const stores = {
    general: { title: 'Mercader', items: [{ name: 'Amuleto de viajero', bonus: 8, price: 45 }, { name: 'Capa de las lindes', bonus: 12, price: 90 }] },
    smith: { title: 'Herrería', items: [{ name: 'Acero lunar', bonus: 18, price: 120 }, { name: 'Hoja de aurora', bonus: 32, price: 260 }] },
    potion: { title: 'Alquimia', items: [{ name: 'Tónico vital', heal: 55, price: 30 }, { name: 'Elixir de maná', mana: 60, price: 30 }] },
  };
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
    levelValue.textContent = `NIVEL ${level} · ${experience} XP`;
    coinValue.textContent = `${coins} ✦`;
  }
  function addPanelEntry(title, description, buttonLabel, action, rarityClass = '') {
    const entry = document.createElement('div');
    entry.className = 'panel-entry';
    const copy = document.createElement('div');
    const heading = document.createElement('strong');
    heading.className = rarityClass;
    heading.textContent = title;
    const detail = document.createElement('small');
    detail.textContent = description;
    copy.append(heading, detail);
    entry.append(copy);
    if (buttonLabel) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = buttonLabel;
      button.addEventListener('click', action);
      entry.append(button);
    }
    panelContent.append(entry);
  }
  function showPanel(mode, zone = currentZone) {
    panelMode = mode;
    panelContent.replaceChildren();
    adventurePanel.hidden = false;
    panelEyebrow.textContent = zone?.town ? zone.town.toUpperCase() : 'AVENTURA';
    if (mode === 'skills') {
      panelTitle.textContent = `Habilidades · ${skillPoints} puntos`;
      for (const [id, name, description] of skillCatalog[selectedHeroId]) {
        const unlocked = unlockedSkills.has(id);
        addPanelEntry(name, `${description}${unlocked ? ' Desbloqueada.' : ''}`, unlocked ? 'DESBLOQUEADA' : '1 PUNTO', () => {
          if (unlocked || skillPoints < 1) return;
          skillPoints--;
          unlockedSkills.add(id);
          if (id === 'resolve') { selectedHero.health += 20; health += 20; }
          if (id === 'quickstep') selectedHero.walkSpeed *= 1.12, selectedHero.runSpeed *= 1.12;
          updateHud();
          showPanel('skills');
        }, unlocked ? 'rarity-uncommon' : '');
      }
    } else if (mode === 'inventory') {
      panelTitle.textContent = 'Equipo y mochila';
      addPanelEntry(equippedItem ? `Equipado: ${equippedItem.name}` : 'Sin equipo equipado', equippedItem ? `${equippedItem.rarity} · +${equippedItem.bonus} daño` : 'Visita la herrería o derrota enemigos para conseguir equipo.', '', null, equippedItem ? rarityColors[rarityOrder.indexOf(equippedItem.rarity)] : '');
      for (const item of inventory) addPanelEntry(`${item.name} · ${item.rarity}`, item.heal ? `Poción: restaura ${item.heal} de vida.` : item.mana ? `Poción: restaura ${item.mana} de maná.` : `+${item.bonus} daño · ${item.rarity}`, item.heal || item.mana ? 'USAR' : 'EQUIPAR', () => {
        if (item.heal) { health = Math.min(selectedHero.health, health + item.heal); }
        else if (item.mana) { mana = Math.min(selectedHero.mana, mana + item.mana); }
        else equippedItem = item;
        inventory.splice(inventory.indexOf(item), 1);
        updateHud();
        showPanel('inventory');
      }, rarityColors[rarityOrder.indexOf(item.rarity)] || 'rarity-common');
      if (!inventory.length) addPanelEntry('Mochila vacía', 'Explora el mundo para encontrar objetos.', '', null);
    } else if (mode === 'journal') {
      panelTitle.textContent = 'Diario de aventuras';
      if (activeQuest) {
        addPanelEntry(activeQuest.title, `${activeQuest.zone.town}: derrota ${activeQuest.target} enemigos (${activeQuest.progress}/${activeQuest.target}).`, activeQuest.progress >= activeQuest.target ? 'COBRAR' : 'EN CURSO', () => {
          if (activeQuest.progress < activeQuest.target) return;
          coins += activeQuest.rewardCoins;
          awardExperience(activeQuest.rewardXp);
          setCombatFeedback(`Misión completada: +${activeQuest.rewardCoins} monedas`, 2);
          activeQuest = null;
          showPanel('journal');
        });
      } else {
        addPanelEntry('Sin misión activa', 'Habla con la gente de cualquier pueblo para aceptar encargos.', '', null);
      }
      for (const zoneItem of zones) {
        addPanelEntry(zoneItem.town, `${zoneItem.name} · ${zoneItem.kind} · Jefe de zona: ${enemySpawns.find((enemy) => enemy.boss && enemy.zone === zoneItem.id)?.name || 'desconocido'}`, zoneItem === currentZone ? 'ESTÁS AQUÍ' : 'VISITAR', () => {
        if (zoneItem === currentZone) showPanel('town', zoneItem);
        else setCombatFeedback(`Sigue la brújula hacia ${zoneItem.town}`, 2);
        });
        const remaining = bossCooldownRemaining(`dungeon-${zoneItem.bossKey}`);
        addPanelEntry(zoneItem.dungeon, `Entrada por arco en ${zoneItem.name}. Jefe: ${zoneItem.dungeonBoss}${remaining ? ` · Reaparece en ${formatCooldown(remaining)}` : ''}. Set único con 10% de probabilidad por victoria.`, '', null, 'rarity-legendary');
      }
    } else if (mode === 'town') {
      panelTitle.textContent = `Pueblo de ${zone.town}`;
      if (!activeQuest) addPanelEntry('Encargo local', `Ayuda a proteger ${zone.town} derrotando a 3 criaturas.`, 'ACEPTAR', () => {
        activeQuest = { title: `Amenaza en ${zone.town}`, zone, target: 3, progress: 0, rewardCoins: 65, rewardXp: 100 };
        showPanel('town', zone);
      });
      else addPanelEntry(activeQuest.title, `${activeQuest.progress}/${activeQuest.target} criaturas derrotadas`, 'VER DIARIO', () => showPanel('journal'));
      for (const key of Object.keys(stores)) addPanelEntry(stores[key].title, key === 'potion' ? 'Pociones de vida y maná.' : 'Armas y equipo con distintas rarezas.', 'ABRIR', () => showPanel(`shop:${key}`, zone));
      addPanelEntry('Árbol de habilidades', `Tienes ${skillPoints} puntos disponibles.`, 'ABRIR', () => showPanel('skills', zone));
    } else if (mode === 'dungeon-entry') {
      panelTitle.textContent = zone.dungeon;
      const remaining = bossCooldownRemaining(`dungeon-${zone.bossKey}`);
      addPanelEntry('Exploración', 'Pasillos profundos, salas del tesoro, trampas y enemigos. El jefe espera al final.', '', null);
      addPanelEntry(zone.dungeonBoss, remaining ? `Jefe en descanso: vuelve en ${formatCooldown(remaining)}. Puedes entrar a explorar y combatir enemigos comunes.` : 'Jefe de la mazmorra disponible.', '', null, 'rarity-legendary');
      addPanelEntry('Entrar en la mazmorra', 'La entrada es una instancia separada; el Valle queda descargado hasta que salgas.', 'ENTRAR', () => enterDungeon(zone));
    } else if (mode === 'soul-replace') {
      panelTitle.textContent = '¿Reemplazar el alma?';
      panelEyebrow.textContent = 'CONFIRMA EL CAMBIO';
      addPanelEntry(`Alma guardada: ${storedSoul.name}`, `Vida ${storedSoul.attributes.health} · Daño ${storedSoul.attributes.damage} · Habilidades: ${storedSoul.skills.join(', ')}.`, '', null);
      addPanelEntry(`Nueva alma: ${pendingSoul.name}`, `Vida ${pendingSoul.attributes.health} · Daño ${pendingSoul.attributes.damage} · Habilidades: ${pendingSoul.skills.join(', ')}. Si reemplazas la guardada, no podrás recuperarla.`, '', null);
      addPanelEntry('Reemplazar alma', 'El cambio es permanente durante esta partida.', 'REEMPLAZAR', () => {
        storedSoul = pendingSoul;
        pendingSoul = null;
        if (summon) removeSummon();
        setCombatFeedback(`Ahora guardas el alma de ${storedSoul.name}`, 2);
        adventurePanel.hidden = true;
      }, 'rarity-legendary');
      addPanelEntry('Conservar alma', 'Mantén la invocación actual y descarta la nueva.', 'CONSERVAR', () => {
        pendingSoul = null;
        adventurePanel.hidden = true;
        setCombatFeedback('Conservaste el alma guardada', 1.5);
      });
    } else if (mode.startsWith('shop:')) {
      const store = stores[mode.slice(5)];
      panelTitle.textContent = store.title;
      addPanelEntry('Tus monedas', `${coins} ✦`, '', null);
      for (const item of store.items) addPanelEntry(item.name, `${item.bonus ? `+${item.bonus} daño · ` : ''}${item.heal ? `cura ${item.heal} vida · ` : ''}${item.mana ? `restaura ${item.mana} maná · ` : ''}${item.price} monedas`, 'COMPRAR', () => {
        if (coins < item.price) { setCombatFeedback('No tienes suficientes monedas', 1.5); return; }
        coins -= item.price;
        const rarity = item.bonus >= 30 ? 'Épico' : item.bonus >= 15 ? 'Raro' : item.bonus >= 10 ? 'Poco común' : 'Común';
        inventory.push({ ...item, rarity });
        updateHud();
        showPanel(mode, zone);
      });
      addPanelEntry(`Volver a ${zone.town}`, 'Encargos, herrería y alquimia.', 'VOLVER', () => showPanel('town', zone));
    }
    needsRender = true;
  }
  function awardExperience(amount) {
    experience += amount;
    while (experience >= level * 100) {
      experience -= level * 100;
      level++;
      skillPoints++;
      selectedHero.health += 8;
      selectedHero.mana += 5;
      health = Math.min(selectedHero.health, health + 8);
      mana = Math.min(selectedHero.mana, mana + 5);
      setCombatFeedback(`¡Nivel ${level}! +1 punto de habilidad`, 2);
    }
    updateHud();
  }
  document.querySelectorAll('[data-panel]').forEach((button) => button.addEventListener('click', () => showPanel(button.dataset.panel)));
  panelClose.addEventListener('click', () => { adventurePanel.hidden = true; panelMode = ''; });
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
  const trainingTitle = document.querySelector('.training-heading span');
  const combatFeedback = document.querySelector('#combat-feedback');
  const interactButton = document.querySelector('#interact');
  const enemyMaterial = new Map([
    ['forest', new THREE.MeshStandardMaterial({ color: '#75834f', roughness: 1 })],
    ['frost', new THREE.MeshStandardMaterial({ color: '#a8c8d0', roughness: 1 })],
    ['ash', new THREE.MeshStandardMaterial({ color: '#7d4940', roughness: 1 })],
    ['sand', new THREE.MeshStandardMaterial({ color: '#a88a53', roughness: 1 })],
    ['meadow', new THREE.MeshStandardMaterial({ color: '#8a7254', roughness: 1 })],
  ]);
  const enemySpawns = [
    { zone: 'meadow', x: 25, z: -7, name: 'Lobo de la frontera', health: 95, damage: 8, xp: 35 },
    { zone: 'meadow', x: -47, z: -13, name: 'Bandido errante', health: 115, damage: 10, xp: 45 },
    { zone: 'forest', x: 116, z: 69, name: 'Acechador musgoso', health: 150, damage: 12, xp: 60 },
    { zone: 'forest', x: 72, z: 82, name: 'Lobo umbrío', health: 165, damage: 14, xp: 65 },
    { zone: 'frost', x: -70, z: 99, name: 'Espectro de escarcha', health: 155, damage: 13, xp: 65 },
    { zone: 'frost', x: -119, z: 53, name: 'Gólem de hielo', health: 220, damage: 18, xp: 90 },
    { zone: 'ash', x: 71, z: -131, name: 'Salteador ceniciento', health: 195, damage: 17, xp: 85 },
    { zone: 'ash', x: 121, z: -83, name: 'Bruto de magma', health: 260, damage: 22, xp: 115 },
    { zone: 'sand', x: -132, z: -81, name: 'Merodeador de dunas', health: 185, damage: 16, xp: 80 },
    { zone: 'sand', x: -83, z: -132, name: 'Escorpión colosal', health: 240, damage: 20, xp: 105 },
    { zone: 'meadow', x: 45, z: 8, name: 'Guardián del Valle', health: 440, damage: 24, xp: 220, boss: true, bossKey: 'area-meadow', bossSet: ['Corona del Rey Raíz', 'Manto de Corteza Antigua', 'Mandoble del Primer Brote'] },
    { zone: 'forest', x: 127, z: 91, name: 'Ciervo de las Mil Astas', health: 620, damage: 30, xp: 300, boss: true, bossKey: 'area-forest', bossSet: ['Astas de la Madre', 'Coraza de Savia', 'Arco del Bosque Hueco'] },
    { zone: 'frost', x: -126, z: 113, name: 'Coloso de Escarcha', health: 700, damage: 34, xp: 340, boss: true, bossKey: 'area-frost', bossSet: ['Yelmo del Titán', 'Placas de Hielo Eterno', 'Martillo del Deshielo'] },
    { zone: 'ash', x: 132, z: -77, name: 'Salamandra Primordial', health: 780, damage: 38, xp: 380, boss: true, bossKey: 'area-ash', bossSet: ['Cresta de Ceniza', 'Escamas de Brasal', 'Lanza de Magma'] },
    { zone: 'sand', x: -81, z: -146, name: 'Devorador de Dunas', health: 720, damage: 36, xp: 360, boss: true, bossKey: 'area-sand', bossSet: ['Diadema del Faraón', 'Velo de Arena Eterna', 'Khopesh Sepultado'] },
  ];
  let bossRespawns = {};
  try {
    const savedRespawns = JSON.parse(localStorage.getItem('pradera-boss-respawns') || '{}');
    if (savedRespawns && typeof savedRespawns === 'object' && !Array.isArray(savedRespawns)) {
      bossRespawns = Object.fromEntries(Object.entries(savedRespawns).filter(([, timestamp]) => Number.isFinite(timestamp) && timestamp > 0));
    }
  } catch {
    // Boss timers still work for the current page when browser storage is unavailable.
  }
  function bossCooldownRemaining(key) {
    return Math.max(0, (bossRespawns[key] || 0) - Date.now());
  }
  function saveBossRespawn(key) {
    bossRespawns[key] = Date.now() + bossCooldownMs;
    try {
      localStorage.setItem('pradera-boss-respawns', JSON.stringify(bossRespawns));
    } catch {
      // The 12-hour timer remains active until this page is closed if storage is unavailable.
    }
  }
  function formatCooldown(milliseconds) {
    const totalMinutes = Math.ceil(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours ? `${hours} h ${String(minutes).padStart(2, '0')} min` : `${minutes} min`;
  }
  const enemies = enemySpawns.map((spawn, index) => {
    const group = new THREE.Group();
    const material = enemyMaterial.get(spawn.zone);
    const bodyMaterial = spawn.boss
      ? new THREE.MeshStandardMaterial({ color: zones.find((zone) => zone.id === spawn.zone).accent, roughness: .8, metalness: .12 })
      : material;
    box(group, spawn.boss ? 1.15 : .68, spawn.boss ? 1.65 : 1.05, spawn.boss ? .8 : .48, bodyMaterial, 0, spawn.boss ? 1.3 : 1.05, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(spawn.boss ? .62 : .38, 8, 6), bodyMaterial);
    head.position.set(0, 1.83, -.03);
    if (spawn.boss) head.position.y = 2.55;
    head.castShadow = true;
    group.add(head);
    const eyes = new THREE.MeshStandardMaterial({ color: '#f1bb78', emissive: '#79411e' });
    for (const side of [-1, 1]) {
      box(group, spawn.boss ? .14 : .08, spawn.boss ? .14 : .08, .05, eyes, side * (spawn.boss ? .25 : .14), spawn.boss ? 2.58 : 1.9, spawn.boss ? -.58 : -.37);
      if (spawn.boss) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(.16, .7, 5), bodyMaterial);
        horn.position.set(side * .48, 3.05, -.02);
        horn.rotation.z = side * -.5;
        group.add(horn);
      }
    }
    group.position.set(spawn.x, heightAt(spawn.x, spawn.z), spawn.z);
    if (spawn.boss) group.scale.setScalar(1.45);
    scene.add(group);
    const respawnAt = spawn.bossKey ? (bossRespawns[spawn.bossKey] || 0) : 0;
    const defeated = Boolean(spawn.bossKey && respawnAt > Date.now());
    group.visible = !defeated;
    return { ...spawn, group, health: defeated ? 0 : spawn.health, maxHealth: spawn.health, cooldown: index * .3, phase: index * 2, dead: defeated, hitFlash: 0, respawnAt, baseScale: spawn.boss ? 1.45 : 1, worldBoss: Boolean(spawn.boss), zoneBoss: Boolean(spawn.boss) };
  });
  const townNpcMaterials = zones.map((zone) => new THREE.MeshStandardMaterial({ color: zone.accent, roughness: 1 }));
  const towns = zones.map((zone, index) => {
    const npcs = [];
    for (let i = 0; i < 3; i++) {
      const npc = new THREE.Group();
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(.28, .4, 1.15, 7), townNpcMaterials[index]);
      robe.position.y = .8;
      const face = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), skin);
      face.position.y = 1.57;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(.29, .42, 6), i === 1 ? roofMaterial : townNpcMaterials[index]);
      hat.position.y = 1.9;
      npc.add(robe, face, hat);
      const x = zone.townX + (i - 1) * 5;
      const z = zone.townZ + 10 + (i % 2) * 2;
      npc.position.set(x, heightAt(x, z), z);
      scene.add(npc);
      npcs.push(npc);
    }
    return { zone, npcs };
  });
  const portalGeometry = new THREE.TorusGeometry(1.3, .15, 8, 24);
  const portalMaterials = zones.map((zone) => new THREE.MeshStandardMaterial({ color: zone.accent, emissive: zone.accent, emissiveIntensity: .65, roughness: .6 }));
  const portals = zones.map((zone, index) => {
    const entrance = new THREE.Group();
    const rockMaterial = new THREE.MeshStandardMaterial({ color: zone.rock, roughness: 1 });
    const pillarGeometry = new THREE.BoxGeometry(.8, 4.6, .9);
    const lintelGeometry = new THREE.BoxGeometry(3.2, .8, 1);
    const left = new THREE.Mesh(pillarGeometry, rockMaterial);
    const right = new THREE.Mesh(pillarGeometry, rockMaterial);
    const lintel = new THREE.Mesh(lintelGeometry, rockMaterial);
    left.position.set(-1.35, 2.3, 0);
    right.position.set(1.35, 2.3, 0);
    lintel.position.set(0, 4.5, 0);
    const ring = new THREE.Mesh(portalGeometry, portalMaterials[index]);
    ring.position.set(0, 2.45, -.12);
    ring.scale.set(.9, 1.65, 1);
    ring.rotation.y = Math.PI;
    const opening = new THREE.Mesh(new THREE.CircleGeometry(1.18, 20), new THREE.MeshBasicMaterial({ color: zone.accent, transparent: true, opacity: .24, side: THREE.DoubleSide }));
    opening.position.set(0, 2.45, .05);
    entrance.add(left, right, lintel, ring, opening);
    entrance.position.set(zone.entranceX, heightAt(zone.entranceX, zone.entranceZ), zone.entranceZ);
    entrance.rotation.y = Math.atan2(zone.x - zone.entranceX, -(zone.z - zone.entranceZ));
    scene.add(entrance);
    return { zone, group: entrance, opening };
  });
  const dungeonPalette = {
    meadow: { wall: '#493b32', floor: '#635849', accent: '#a5b66b', trap: '#c76d45' },
    forest: { wall: '#344438', floor: '#465646', accent: '#9ab66b', trap: '#ad5b46' },
    frost: { wall: '#526b73', floor: '#83999b', accent: '#d9eeee', trap: '#85c8d6' },
    ash: { wall: '#513a37', floor: '#64504a', accent: '#e08b51', trap: '#f07439' },
    sand: { wall: '#66543c', floor: '#9d8257', accent: '#e2c47a', trap: '#c34b35' },
  };
  const dungeonBossSets = {
    meadow: ['Yelmo del Rey Raíz', 'Armadura de Corteza Eterna', 'Hoja del Corazón Verde'],
    forest: ['Corona de Espinas Vivas', 'Manto de la Madre del Bosque', 'Arco de Savia Primordial'],
    frost: ['Diadema del Titán Glacial', 'Coraza del Invierno Eterno', 'Martillo Quebracumbres'],
    ash: ['Cuernos del Dragón de Ceniza', 'Escamas de la Llama Negra', 'Mandoble Volcánico'],
    sand: ['Máscara del Faraón', 'Sudario de las Dunas', 'Cetro del Palacio Sepultado'],
  };
  function setOverworldVisible(visible) {
    for (const chunk of chunks.values()) chunk.visible = visible;
    trainingDummy.visible = visible;
    for (const enemy of enemies) if (!enemy.dungeonId) enemy.group.visible = visible && !enemy.dead;
    for (const town of towns) for (const npc of town.npcs) npc.visible = visible;
    for (const portal of portals) portal.group.visible = visible;
  }
  function disposeGroup(group) {
    group.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
  }
  function buildDungeon(zone) {
    const palette = dungeonPalette[zone.id];
    const cells = new Set();
    const cellTypes = new Map();
    const cellId = (x, z) => `${x},${z}`;
    function carve(x, z, type = 'corridor') {
      if (x < 0 || x > 10 || z < 0 || z > 10) return;
      const id = cellId(x, z);
      cells.add(id);
      if (type !== 'corridor' || !cellTypes.has(id)) cellTypes.set(id, type);
    }
    function carvePath(start, end) {
      let [x, z] = start;
      const [endX, endZ] = end;
      carve(x, z);
      while (x !== endX) { x += Math.sign(endX - x); carve(x, z); }
      while (z !== endZ) { z += Math.sign(endZ - z); carve(x, z); }
    }
    [
      [[5, 10], [5, 7]], [[5, 7], [2, 7]], [[2, 7], [2, 5]],
      [[2, 5], [8, 5]], [[8, 5], [8, 3]], [[8, 3], [5, 3]],
      [[5, 3], [5, 1]], [[2, 5], [1, 5]], [[1, 5], [1, 3]],
      [[8, 5], [9, 5]], [[9, 5], [9, 3]], [[2, 7], [2, 8]],
      [[2, 8], [2, 9]],
    ].forEach(([start, end]) => carvePath(start, end));
    function carveRoom(centerX, centerZ, width, depth, type) {
      const startX = centerX - Math.floor(width / 2);
      const startZ = centerZ - Math.floor(depth / 2);
      for (let x = startX; x < startX + width; x++) {
        for (let z = startZ; z < startZ + depth; z++) carve(x, z, type);
      }
    }
    carveRoom(1, 3, 3, 3, 'treasure');
    carveRoom(9, 3, 3, 3, 'treasure');
    carveRoom(2, 9, 3, 3, 'treasure');
    carveRoom(5, 1, 3, 3, 'boss');
    [[5, 8], [5, 6], [7, 5], [8, 4], [3, 5], [2, 6], [9, 4]].forEach(([x, z]) => carve(x, z, 'trap'));
    const group = new THREE.Group();
    const floorMaterial = new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 1 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: palette.wall, roughness: .95 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: palette.accent, emissive: palette.accent, emissiveIntensity: .24, roughness: .75 });
    const trapMaterial = new THREE.MeshStandardMaterial({ color: palette.trap, emissive: palette.trap, emissiveIntensity: .55, roughness: .65 });
    const floorGeometry = new THREE.BoxGeometry(13.7, .7, 13.7);
    const wallGeometry = new THREE.BoxGeometry(14, 6, .7);
    const roomFloorGeometry = new THREE.BoxGeometry(14, .16, 14);
    const center = (x, z) => new THREE.Vector3((x - 5) * 14, 0, (z - 5) * 14);
    for (const id of cells) {
      const [x, z] = id.split(',').map(Number);
      const position = center(x, z);
      const type = cellTypes.get(id);
      const floor = new THREE.Mesh(type === 'corridor' || type === 'trap' ? floorGeometry : roomFloorGeometry, floorMaterial);
      floor.position.set(position.x, -.38, position.z);
      floor.receiveShadow = true;
      group.add(floor);
      for (const [dx, dz, rotation] of [[0, -1, 0], [1, 0, Math.PI / 2], [0, 1, 0], [-1, 0, Math.PI / 2]]) {
        if (cells.has(cellId(x + dx, z + dz))) continue;
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(position.x + dx * 6.65, 2.6, position.z + dz * 6.65);
        wall.rotation.y = rotation;
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);
      }
      if (type === 'trap') {
        for (let i = -1; i <= 1; i++) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(.38, 1.35, 5), trapMaterial);
          spike.position.set(position.x + i * 2.7, .46, position.z);
          spike.castShadow = true;
          group.add(spike);
        }
      }
    }
    const dungeonId = `dungeon-${zone.bossKey}`;
    const chestCells = [[1, 3], [9, 3], [2, 9], [7, 5]];
    const chests = [];
    chestCells.forEach(([x, z], index) => {
      const chestId = `${dungeonId}-${index}`;
      const chest = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 1.4), new THREE.MeshStandardMaterial({ color: '#76512d', roughness: .78 }));
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.2, .45, 1.5), accentMaterial);
      base.position.y = .55;
      lid.position.y = 1.25;
      chest.add(base, lid);
      const position = center(x, z);
      chest.position.set(position.x, 0, position.z);
      base.castShadow = lid.castShadow = true;
      group.add(chest);
      chests.push({ id: chestId, group: chest, position: new THREE.Vector3(position.x, 0, position.z) });
    });
    const exit = new THREE.Group();
    const exitRing = new THREE.Mesh(new THREE.TorusGeometry(1.3, .15, 8, 24), accentMaterial);
    exitRing.position.y = 2.35;
    exitRing.scale.set(.85, 1.5, 1);
    exit.add(exitRing);
    const exitPosition = center(5, 10);
    exit.position.set(exitPosition.x, 0, exitPosition.z);
    group.add(exit);
    const enemyTheme = new THREE.MeshStandardMaterial({ color: zone.accent, roughness: .88 });
    const dungeonEnemyLayout = [
      [2, 7], [2, 6], [4, 5], [6, 5], [8, 4], [5, 3],
      [3, 7], [1, 4], [9, 4], [2, 8], [3, 8], [7, 5],
      [7, 4], [4, 2], [6, 2], [1, 2], [9, 2], [4, 1],
    ];
    const dungeonEnemies = dungeonEnemyLayout.map(([x, z], index) => {
      const mob = new THREE.Group();
      box(mob, .75, 1.15, .55, enemyTheme, 0, .8, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 8, 6), enemyTheme);
      head.position.y = 1.62;
      mob.add(head);
      const position = center(x, z);
      mob.position.set(position.x + (index % 2 ? 2 : -2), 0, position.z + (index % 3 - 1) * 2);
      mob.castShadow = true;
      group.add(mob);
      return {
        zone: zone.id, name: `${['Guardián', 'Acechador', 'Espectro'][index % 3]} de ${zone.dungeon}`,
        health: 120 + index % 4 * 25, maxHealth: 120 + index % 4 * 25,
        damage: 12 + index % 5 * 2, xp: 45 + index % 4 * 15,
        group: mob, cooldown: index * .15, phase: index, dead: false, hitFlash: 0,
        dungeonId, respawnAt: 0, baseScale: 1,
      };
    });
    const bossReady = bossCooldownRemaining(`dungeon-${zone.bossKey}`) === 0;
    let dungeonBoss = null;
    if (bossReady) {
      const bossGroup = new THREE.Group();
      const bossMaterial = new THREE.MeshStandardMaterial({ color: zone.accent, emissive: palette.trap, emissiveIntensity: .18, roughness: .75, metalness: .12 });
      box(bossGroup, 2, 2.7, 1.5, bossMaterial, 0, 1.65, 0);
      const bossHead = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), bossMaterial);
      bossHead.position.y = 3.45;
      bossGroup.add(bossHead);
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(.3, 1.2, 5), bossMaterial);
        horn.position.set(side * .75, 4.1, 0);
        horn.rotation.z = side * -.48;
        bossGroup.add(horn);
      }
      const position = center(5, 1);
      bossGroup.position.set(position.x, 0, position.z);
      bossGroup.scale.setScalar(1.4);
      bossGroup.traverse((object) => { if (object.isMesh) object.castShadow = true; });
      group.add(bossGroup);
      dungeonBoss = {
        zone: zone.id, name: zone.dungeonBoss, health: 1800 + level * 100,
        maxHealth: 1800 + level * 100, damage: 42, xp: 700,
        group: bossGroup, cooldown: 0, phase: 0, dead: false, hitFlash: 0,
        boss: true, bossKey: `dungeon-${zone.bossKey}`, bossSet: dungeonBossSets[zone.id],
        dungeonId, isDungeonBoss: true, respawnAt: 0, baseScale: 1.4,
      };
      dungeonEnemies.push(dungeonBoss);
    }
    scene.add(group);
    activeDungeon = {
      id: dungeonId, zone, group, enemies: dungeonEnemies, boss: dungeonBoss,
      traps: [[5, 8], [5, 6], [7, 5], [8, 4], [3, 5], [2, 6], [9, 4]].map(([x, z]) => center(x, z)),
      trapCooldown: 0, chests, exitPosition, nextMobSpawn: 0, palette,
      cells,
      wallMaterial, floorMaterial, accentMaterial, trapMaterial,
      enemyMaterial: enemyTheme,
      exitWorld: { x: zone.entranceX, z: zone.entranceZ + 5 },
    };
    enemies.push(...dungeonEnemies);
    return activeDungeon;
  }
  function enterDungeon(zone) {
    if (activeDungeon) return;
    const position = player.position.clone();
    activeDungeon = buildDungeon(zone);
    activeDungeon.returnPosition = { x: position.x, z: position.z };
    setOverworldVisible(false);
    trainingHud.hidden = true;
    player.position.set(0, 0, 57);
    player.rotation.y = 0;
    yaw = 0;
    pitch = .22;
    scene.background = new THREE.Color('#171716');
    scene.fog = new THREE.Fog('#171716', 68, 105);
    dungeonHud.hidden = false;
    dungeonTitle.textContent = zone.dungeon;
    zoneEyebrow.textContent = zone.kind;
    zoneName.textContent = zone.dungeon;
    zoneDescription.textContent = `Jefe de mazmorra: ${zone.dungeonBoss}`;
    updateDungeonBossStatus();
    adventurePanel.hidden = true;
    nearbyEntrance = null;
    interactButton.hidden = true;
    setCombatFeedback(`Entraste en ${zone.dungeon}. Busca tesoros y trampas antes del jefe.`, 3);
    updateCamera(0, true);
  }
  function leaveDungeon() {
    if (!activeDungeon) return;
    const dungeon = activeDungeon;
    for (const enemy of dungeon.enemies) {
      scene.remove(enemy.group);
      disposeGroup(enemy.group);
    }
    enemies.splice(0, enemies.length, ...enemies.filter((enemy) => enemy.dungeonId !== dungeon.id));
    scene.remove(dungeon.group);
    disposeGroup(dungeon.group);
    dungeon.wallMaterial.dispose();
    dungeon.floorMaterial.dispose();
    dungeon.accentMaterial.dispose();
    dungeon.trapMaterial.dispose();
    dungeon.enemyMaterial.dispose();
    activeDungeon = null;
    setOverworldVisible(true);
    player.position.set(dungeon.returnPosition.x, heightAt(dungeon.returnPosition.x, dungeon.returnPosition.z), dungeon.returnPosition.z);
    scene.background = new THREE.Color('#bedcde');
    scene.fog = new THREE.Fog('#bedcde', 48, 82);
    zoneEyebrow.textContent = currentZone.kind;
    zoneName.textContent = currentZone.name;
    zoneDescription.textContent = currentZone.description;
    dungeonHud.hidden = true;
    trainingHud.hidden = false;
    nearbyTreasure = null;
    nearbyEntrance = null;
    interactButton.hidden = true;
    updateChunks(player.position.x, player.position.z);
    updateCamera(0, true);
    setCombatFeedback(`Saliste de ${dungeon.zone.dungeon}`, 2);
  }
  leaveDungeonButton.addEventListener('click', leaveDungeon);
  function updateDungeonBossStatus() {
    if (!activeDungeon) return;
    const remaining = bossCooldownRemaining(`dungeon-${activeDungeon.zone.bossKey}`);
    dungeonBossStatus.textContent = remaining > 0
      ? `${activeDungeon.zone.dungeonBoss}: reaparece en ${formatCooldown(remaining)}. Los enemigos comunes siguen apareciendo.`
      : !activeDungeon.boss
        ? `${activeDungeon.zone.dungeonBoss}: listo. Sal y vuelve a entrar para invocarlo.`
        : activeDungeon.boss.dead
          ? `${activeDungeon.zone.dungeonBoss}: jefe derrotado. Los enemigos comunes siguen apareciendo.`
      : `Jefe activo: ${activeDungeon.zone.dungeonBoss}`;
    const boss = activeDungeon.boss;
    dungeonBossTrack.hidden = !boss || boss.dead;
    if (boss && !boss.dead) {
      const percent = boss.health / boss.maxHealth * 100;
      dungeonBossBar.style.width = `${percent}%`;
      dungeonBossTrack.setAttribute('aria-valuenow', String(Math.ceil(percent)));
    }
  }
  let storedSoul = null;
  let pendingSoul = null;
  let summon = null;
  const spellEffects = [];
  const spellGeometry = new THREE.SphereGeometry(.24, 8, 8);
  function removeSummon() {
    if (!summon) return;
    scene.remove(summon.group);
    summon.group.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
    summon = null;
  }
  function spawnSpellEffect(targetPosition) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    const start = player.position.clone().add(new THREE.Vector3(0, 1.55, 0)).addScaledVector(forward, .5);
    const end = targetPosition
      ? targetPosition.clone().add(new THREE.Vector3(0, 1.15, 0))
      : start.clone().addScaledVector(forward, 10);
    const material = new THREE.MeshStandardMaterial({ color: '#b8d5ff', emissive: '#628cff', emissiveIntensity: 2, transparent: true, opacity: .95 });
    const orb = new THREE.Mesh(spellGeometry, material);
    orb.position.copy(start);
    scene.add(orb);
    spellEffects.push({ orb, material, start, end, elapsed: 0, duration: .42 });
  }
  document.querySelector('#ability').textContent = zoneAbilityNames[selectedHeroId];

  function rarityRoll() {
    const roll = Math.random();
    const index = roll > .99 ? 5 : roll > .95 ? 4 : roll > .86 ? 3 : roll > .68 ? 2 : roll > .36 ? 1 : 0;
    return rarityOrder[index];
  }
  function dropLoot(enemy) {
    const rarity = rarityRoll();
    const rarityIndex = rarityOrder.indexOf(rarity);
    const names = ['Reliquia', 'Arma', 'Armadura', 'Talismán', 'Esencia'];
    const item = { name: `${names[Math.floor(Math.random() * names.length)]} de ${enemy.name}`, rarity, bonus: 3 + rarityIndex * 7 };
    inventory.push(item);
    coins += 8 + rarityIndex * 12;
    setCombatFeedback(`Botín: ${item.name} · ${rarity} · +${item.bonus} daño`, 2);
    updateHud();
  }
  function recordEnemyDefeat(enemy) {
    enemy.dead = true;
    enemy.group.visible = false;
    if (enemy.bossKey) {
      saveBossRespawn(enemy.bossKey);
      enemy.respawnAt = bossRespawns[enemy.bossKey];
      coins += 100;
      if (enemy.bossSet?.length && Math.random() < .1) {
        const name = enemy.bossSet[Math.floor(Math.random() * enemy.bossSet.length)];
        const piece = { name, rarity: 'Mítico', bonus: 55 + Math.floor(level * 2), uniqueBossDrop: true };
        inventory.push(piece);
        setCombatFeedback(`¡Pieza única de jefe! ${name} · 10%`, 4);
      }
      if (enemy.isDungeonBoss) updateDungeonBossStatus();
    } else {
      coins += 12 + Math.floor(Math.random() * 12);
      if (enemy.dungeonId) enemy.respawnAt = performance.now() / 1000 + 14;
    }
    awardExperience(enemy.xp);
    if (activeQuest && activeQuest.zone.id === enemy.zone) activeQuest.progress = Math.min(activeQuest.target, activeQuest.progress + 1);
    if (Math.random() < (enemy.bossKey ? .85 : .76)) dropLoot(enemy);
    if (selectedHeroId === 'necromancer') {
      const soul = { name: enemy.name, attributes: { health: enemy.maxHealth, damage: enemy.damage, experience: enemy.xp }, skills: [`Golpe de ${enemy.name}`, 'Instinto de combate'], zone: enemy.zone };
      if (!storedSoul) {
        storedSoul = soul;
        setCombatFeedback(`Alma capturada: ${soul.name}. Pulsa HABILIDAD para invocarla.`, 3);
      } else {
        pendingSoul = soul;
        showPanel('soul-replace');
      }
    }
  }

  function updateTrainingHud() {
    const nearbyBoss = activeDungeon ? null : enemies
      .filter((enemy) => enemy.worldBoss && !enemy.dead && enemy.group.visible)
      .map((enemy) => ({ enemy, distance: enemy.group.position.distanceTo(player.position) }))
      .filter(({ distance }) => distance < 34)
      .sort((a, b) => a.distance - b.distance)[0]?.enemy || null;
    if (nearbyBoss) {
      trainingTitle.textContent = `JEFE DE ZONA · ${nearbyBoss.name.toUpperCase()}`;
      trainingHealthValue.textContent = `${Math.ceil(nearbyBoss.health)} / ${nearbyBoss.maxHealth}`;
      trainingHealthBar.style.width = `${nearbyBoss.health / nearbyBoss.maxHealth * 100}%`;
      trainingHealthTrack.setAttribute('aria-valuemax', String(nearbyBoss.maxHealth));
      trainingHealthTrack.setAttribute('aria-valuenow', String(Math.ceil(nearbyBoss.health)));
      return;
    }
    trainingTitle.textContent = 'MANIQUÍ DE PRÁCTICA';
    trainingHealthValue.textContent = `${Math.ceil(trainingHealth)} / ${trainingMaxHealth}`;
    trainingHealthBar.style.width = `${trainingHealth / trainingMaxHealth * 100}%`;
    trainingHealthTrack.setAttribute('aria-valuemax', String(trainingMaxHealth));
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
  let playerHitCooldown = 0;
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
  function findTarget(range, requireFacing = true) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    return enemies
      .filter((enemy) => !enemy.dead && enemy.group.visible)
      .map((enemy) => {
        const toEnemy = new THREE.Vector3(enemy.group.position.x - player.position.x, 0, enemy.group.position.z - player.position.z);
        const distance = toEnemy.length();
        return { enemy, distance, facing: distance ? forward.dot(toEnemy.normalize()) : 1 };
      })
      .filter((targetInfo) => targetInfo.distance <= range && (!requireFacing || targetInfo.facing >= .05))
      .sort((a, b) => a.distance - b.distance)[0]?.enemy || null;
  }
  function damageEnemy(enemy, amount) {
    enemy.health = Math.max(0, enemy.health - amount);
    enemy.hitFlash = .2;
    enemy.group.position.x += (enemy.group.position.x - player.position.x) * .025;
    if (enemy.worldBoss) updateTrainingHud();
    if (enemy.isDungeonBoss) updateDungeonBossStatus();
    if (enemy.health === 0) recordEnemyDefeat(enemy);
    else setCombatFeedback(`${enemy.name} · −${amount} · ${Math.ceil(enemy.health)} PV`, .9);
  }
  function damageNearbyEnemies(amount, range, multi = false) {
    const targets = enemies
      .filter((enemy) => !enemy.dead && enemy.group.visible)
      .map((enemy) => ({ enemy, distance: enemy.group.position.distanceTo(player.position) }))
      .filter(({ distance }) => distance <= range)
      .sort((a, b) => a.distance - b.distance);
    if (!targets.length) {
      setCombatFeedback('No hay enemigos al alcance', 1);
      return;
    }
    for (const { enemy } of (multi ? targets : targets.slice(0, 1))) damageEnemy(enemy, amount);
  }
  function damageTrainingDummy(amount) {
    const enemy = findTarget(3.35);
    if (enemy) {
      damageEnemy(enemy, amount);
      return;
    }
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
  function startAbility() {
    if (!playing || attack || blockHeld) return;
    if (selectedHeroId === 'necromancer') {
      if (!storedSoul) { setCombatFeedback('Derrota a un enemigo para capturar su alma', 1.5); return; }
      if (summon) {
        removeSummon();
        setCombatFeedback('La invocación vuelve al mundo de las sombras', 1.5);
        return;
      }
      const cost = unlockedSkills.has('focus') ? 20 : 25;
      if (mana < cost) { setCombatFeedback('No tienes maná suficiente', 1); return; }
      mana -= cost;
      const group = new THREE.Group();
      const spiritMaterial = new THREE.MeshStandardMaterial({ color: '#b48bc4', emissive: '#50385e', transparent: true, opacity: .8 });
      box(group, .65, 1.05, .48, spiritMaterial, 0, 1.05, 0);
      const spiritHead = new THREE.Mesh(new THREE.SphereGeometry(.35, 8, 6), spiritMaterial);
      spiritHead.position.y = 1.82;
      group.add(spiritHead);
      group.position.copy(player.position);
      group.position.x += 1.5;
      group.position.y = heightAt(group.position.x, group.position.z);
      scene.add(group);
      summon = { group, health: storedSoul.attributes.health * (unlockedSkills.has('bond') ? 1.5 : 1), maxHealth: storedSoul.attributes.health, damage: storedSoul.attributes.damage, cooldown: 0 };
      updateHud();
      setCombatFeedback(`${storedSoul.name} ha sido invocado. Pulsa de nuevo para despedirlo.`, 2);
      return;
    }
    const manaCost = selectedHeroId === 'mage' ? 28 : 0;
    const staminaCost = selectedHeroId === 'mage' ? 0 : selectedHeroId === 'archer' ? 18 : 25;
    const finalManaCost = unlockedSkills.has('focus') ? Math.ceil(manaCost * .8) : manaCost;
    if (mana < finalManaCost || stamina < staminaCost) {
      setCombatFeedback(mana < finalManaCost ? 'No tienes maná suficiente' : 'No tienes estamina suficiente', 1);
      return;
    }
    mana -= finalManaCost;
    stamina -= staminaCost;
    updateHud();
    attack = { type: 'ability', combo: 1, elapsed: 0, duration: 1.05, hit: false };
    setCombatFeedback(zoneAbilityNames[selectedHeroId], .8);
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
  const abilityButton = document.querySelector('#ability');
  const blockButton = document.querySelector('#block');
  function openTreasure(chest) {
    if (!activeDungeon || !activeDungeon.chests.includes(chest)) return;
    activeDungeon.group.remove(chest.group);
    disposeGroup(chest.group);
    activeDungeon.chests = activeDungeon.chests.filter((item) => item !== chest);
    nearbyTreasure = null;
    const rarity = rarityOrder[Math.min(rarityOrder.length - 1, Math.floor(Math.random() * rarityOrder.length))];
    const rarityIndex = rarityOrder.indexOf(rarity);
    const names = dungeonBossSets[activeDungeon.zone.id];
    const item = { name: `${names[Math.floor(Math.random() * names.length)]} · Tesoro`, rarity, bonus: 9 + rarityIndex * 8 };
    inventory.push(item);
    coins += 40 + rarityIndex * 20;
    updateHud();
    setCombatFeedback(`Tesoro encontrado: ${item.name} · ${rarity} · +${item.bonus} daño`, 3);
  }
  function interactWithTown() {
    if (!playing) return;
    if (activeDungeon && nearbyTreasure) {
      openTreasure(nearbyTreasure);
      return;
    }
    if (activeDungeon && Math.hypot(player.position.x - activeDungeon.exitPosition.x, player.position.z - activeDungeon.exitPosition.z) < 5) {
      leaveDungeon();
      return;
    }
    if (!activeDungeon && nearbyEntrance) {
      showPanel('dungeon-entry', nearbyEntrance.zone);
      return;
    }
    if (!nearbyTown) return;
    showPanel('town', nearbyTown);
  }
  interactButton.addEventListener('click', interactWithTown);
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
  abilityButton.addEventListener('click', (event) => {
    if (deviceMode.value !== 'mobile') return;
    event.preventDefault();
    startAbility();
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
    dungeonHud.hidden = true;
    adventurePanel.hidden = true;
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
    dungeonHud.hidden = !activeDungeon;
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
    if (event.code === 'KeyR') {
      event.preventDefault();
      startAbility();
      return;
    }
    if (event.code === 'KeyE') {
      event.preventDefault();
      interactWithTown();
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
      const clearance = activeDungeon ? -2 : heightAt(look.x, look.z) + .55;
      if (look.y < clearance) cameraGoal.y += (clearance - look.y) / (i / 16);
    }
    camera.position.lerp(cameraGoal, snap ? 1 : 1 - Math.exp(-12 * dt));
    camera.position.y = Math.max(camera.position.y, activeDungeon ? .8 : heightAt(camera.position.x, camera.position.z) + .55);
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
  function canWalkInDungeon(x, z) {
    if (!activeDungeon) return true;
    const cellX = Math.floor((x + 7) / 14) + 5;
    const cellZ = Math.floor((z + 7) / 14) + 5;
    return activeDungeon.cells.has(`${cellX},${cellZ}`);
  }
  window.addEventListener('resize', resize);
  resize();
  updateChunks(player.position.x, player.position.z);
  updateCamera(0, true);
  let lastTime = performance.now();
  let nextBossHudUpdate = 0;
  let nextTrainingHudUpdate = 0;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - lastTime) / 1000, .05);
    lastTime = now;
    if (!playing && !needsRender) return;
    if (playing && adventurePanel.hidden) {
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
      const previousX = player.position.x;
      const previousZ = player.position.z;
      player.position.addScaledVector(move, speed * dt);
      if (activeDungeon) {
        player.position.x = THREE.MathUtils.clamp(player.position.x, -75, 75);
        player.position.z = THREE.MathUtils.clamp(player.position.z, -75, 75);
        if (!canWalkInDungeon(player.position.x, player.position.z)) {
          player.position.x = previousX;
          player.position.z = previousZ;
          speed = 0;
        }
      } else {
        player.position.x = THREE.MathUtils.clamp(player.position.x, -playerLimit, playerLimit);
        player.position.z = THREE.MathUtils.clamp(player.position.z, -playerLimit, playerLimit);
      }
      player.position.y = activeDungeon ? 0 : heightAt(player.position.x, player.position.z);
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
        attackPose = attack.type === 'heavy' ? 2.9 * strike - .82 * windup : attack.type === 'ability' ? 2.6 * strike - .7 * windup : 2.3 * strike - .48 * windup;
        attackTwist = (attack.combo % 2 ? 1 : -1) * strike * (attack.type === 'heavy' ? .55 : .32);
        if (!attack.hit && attackProgress >= .3) {
          attack.hit = true;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
          player.position.addScaledVector(forward, attack.type === 'heavy' ? .42 : .22);
          player.position.x = THREE.MathUtils.clamp(player.position.x, -playerLimit, playerLimit);
          player.position.z = THREE.MathUtils.clamp(player.position.z, -playerLimit, playerLimit);
          if (activeDungeon) {
            player.position.x = THREE.MathUtils.clamp(player.position.x, -75, 75);
            player.position.z = THREE.MathUtils.clamp(player.position.z, -75, 75);
            if (!canWalkInDungeon(player.position.x, player.position.z)) {
              player.position.x -= forward.x * (attack.type === 'heavy' ? .42 : .22);
              player.position.z -= forward.z * (attack.type === 'heavy' ? .42 : .22);
            }
            player.position.y = 0;
          } else {
            player.position.y = heightAt(player.position.x, player.position.z);
          }
          if (attack.type === 'ability') {
            const levelBonus = level * 8;
            const classBonus = unlockedSkills.has('spark') || unlockedSkills.has('harvest') ? 1.25 : 1;
            if (selectedHeroId === 'mage') {
              const targetEnemy = findTarget(14);
              spawnSpellEffect(targetEnemy?.group.position || null);
              if (targetEnemy) damageEnemy(targetEnemy, Math.round((100 + levelBonus) * classBonus));
              else damageTrainingDummy(Math.round((100 + levelBonus) * classBonus));
              if (unlockedSkills.has('surge') && targetEnemy && !targetEnemy.dead) {
                spawnSpellEffect(targetEnemy.group.position);
                damageEnemy(targetEnemy, Math.round((100 + levelBonus) * classBonus * .5));
              }
            } else if (selectedHeroId === 'tank') {
              damageNearbyEnemies(Math.round((78 + levelBonus) * (unlockedSkills.has('slam') ? 1.3 : 1)), 4.2, true);
            } else if (selectedHeroId === 'archer') {
              damageNearbyEnemies(Math.round((68 + levelBonus) * (unlockedSkills.has('aim') ? 1.25 : 1)), 15, unlockedSkills.has('volley'));
            } else {
              player.position.addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion), 1.1);
              damageNearbyEnemies(Math.round(92 + levelBonus), 4.8, false);
            }
          } else {
            const classDamage = selectedHeroId === 'mage' ? 1.35 : 1;
            const skillDamage = unlockedSkills.has('blade') || unlockedSkills.has('aim') || unlockedSkills.has('harvest') ? 1.2 : 1;
            const heavyDamage = attack.type === 'heavy' ? (unlockedSkills.has('slam') && selectedHeroId === 'tank' ? 1.3 : 1) : 1;
            const equipmentDamage = equippedItem?.bonus || 0;
            damageTrainingDummy(Math.round(((attack.type === 'heavy' ? 58 + attack.combo * 16 : 24 + attack.combo * 12) + equipmentDamage) * classDamage * skillDamage * heavyDamage));
          }
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
      playerHitCooldown = Math.max(0, playerHitCooldown - dt);
      for (const enemy of enemies) {
        if (enemy.dead) {
          if (enemy.dungeonId === activeDungeon?.id && !enemy.isDungeonBoss && gameTime >= enemy.respawnAt) {
            enemy.dead = false;
            enemy.health = enemy.maxHealth;
            enemy.group.visible = true;
          } else if (!enemy.dungeonId && enemy.bossKey && Date.now() >= enemy.respawnAt) {
            enemy.dead = false;
            enemy.health = enemy.maxHealth;
            enemy.group.visible = true;
            enemy.respawnAt = 0;
          }
          if (enemy.dead) continue;
        }
        if (!enemy.group.visible) continue;
        const toPlayer = new THREE.Vector3(player.position.x - enemy.group.position.x, 0, player.position.z - enemy.group.position.z);
        const distance = toPlayer.length();
        const aggroRange = enemy.dungeonId ? 28 : enemy.zone === 'meadow' ? 18 : 32;
        if (distance < aggroRange && distance > 2.1) {
          toPlayer.normalize();
          enemy.group.position.addScaledVector(toPlayer, (enemy.zone === 'ash' ? 2.1 : 1.7) * dt);
          enemy.group.position.y = activeDungeon ? 0 : heightAt(enemy.group.position.x, enemy.group.position.z);
          enemy.group.rotation.y = Math.atan2(-toPlayer.x, -toPlayer.z);
          enemy.phase += dt * 5;
          enemy.group.position.y += Math.abs(Math.sin(enemy.phase)) * .04;
        } else if (distance <= 2.1 && enemy.cooldown <= 0 && playerHitCooldown <= 0) {
          const reduction = (blockHeld && selectedHero.shield ? .72 : 0)
            + (unlockedSkills.has('guard') ? .15 : 0)
            + (unlockedSkills.has('bastion') ? .25 : 0);
          const incoming = Math.max(1, Math.round(enemy.damage * (1 - Math.min(.9, reduction))));
          health = Math.max(0, health - incoming);
          enemy.cooldown = 1.4;
          playerHitCooldown = .55;
          updateHud();
          setCombatFeedback(blockHeld && selectedHero.shield ? `Bloqueaste un golpe · −${incoming} vida` : `${enemy.name} te golpeó · −${incoming} vida`, 1);
          if (health === 0) {
            health = selectedHero.health;
            stamina = selectedHero.stamina;
            mana = Math.max(0, mana - 15);
            if (activeDungeon) player.position.set(0, 0, 57);
            else player.position.set(0, heightAt(0, -18), -18);
            if (summon) removeSummon();
            updateHud();
            setCombatFeedback('Has caído y regresaste al Valle de Bruma. Perdiste 15 de maná.', 3);
          }
        }
        enemy.cooldown = Math.max(0, enemy.cooldown - dt);
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        enemy.group.scale.setScalar(enemy.baseScale * (enemy.hitFlash > 0 ? 1.08 : 1));
      }
      if (summon) {
        summon.cooldown = Math.max(0, summon.cooldown - dt);
        const distance = summon.group.position.distanceTo(player.position);
        if (distance > 2.3) {
          const follow = new THREE.Vector3(player.position.x - summon.group.position.x, 0, player.position.z - summon.group.position.z).normalize();
          summon.group.position.addScaledVector(follow, Math.min(distance - 1.5, 5) * dt);
          summon.group.position.y = activeDungeon ? 0 : heightAt(summon.group.position.x, summon.group.position.z);
        }
        const prey = enemies
          .filter((enemy) => !enemy.dead && enemy.group.visible)
          .map((enemy) => ({ enemy, distance: enemy.group.position.distanceTo(summon.group.position) }))
          .filter(({ distance: enemyDistance }) => enemyDistance < 2.8)
          .sort((a, b) => a.distance - b.distance)[0]?.enemy;
        if (prey && summon.cooldown === 0) {
          damageEnemy(prey, Math.max(8, Math.round(summon.damage * .65)));
          summon.cooldown = 1.25;
        }
      }
      for (let i = spellEffects.length - 1; i >= 0; i--) {
        const effect = spellEffects[i];
        effect.elapsed += dt;
        const progress = Math.min(1, effect.elapsed / effect.duration);
        effect.orb.position.lerpVectors(effect.start, effect.end, progress);
        effect.orb.scale.setScalar(.85 + Math.sin(progress * Math.PI) * .55);
        effect.material.opacity = 1 - progress * .65;
        if (progress === 1) {
          scene.remove(effect.orb);
          effect.material.dispose();
          spellEffects.splice(i, 1);
        }
      }
      if (activeDungeon) {
        activeDungeon.trapCooldown = Math.max(0, activeDungeon.trapCooldown - dt);
        if (activeDungeon.trapCooldown === 0 && activeDungeon.traps.some((trap) => Math.hypot(player.position.x - trap.x, player.position.z - trap.z) < 3.2)) {
          const damage = Math.max(1, Math.round(selectedHero.health * .14));
          health = Math.max(1, health - damage);
          updateHud();
          activeDungeon.trapCooldown = 2.4;
          setCombatFeedback(`¡Trampa! −${damage} de vida`, 1.4);
        }
        if (now > nextBossHudUpdate) {
          updateDungeonBossStatus();
          nextBossHudUpdate = now + 1000;
        }
        nearbyTreasure = activeDungeon.chests.find((chest) => chest.position.distanceTo(player.position) < 5) || null;
        interactButton.hidden = !nearbyTreasure;
        interactButton.textContent = 'ABRIR TESORO';
        const exitDistance = Math.hypot(player.position.x - activeDungeon.exitPosition.x, player.position.z - activeDungeon.exitPosition.z);
        if (exitDistance < 5 && !nearbyTreasure) {
          interactButton.hidden = false;
          interactButton.textContent = 'SALIR';
          nearbyTreasure = null;
        }
      } else {
        if (now > nextTrainingHudUpdate) {
          updateTrainingHud();
          nextTrainingHudUpdate = now + 500;
        }
        nearbyEntrance = portals
          .map((portal) => ({ portal, distance: Math.hypot(player.position.x - portal.zone.entranceX, player.position.z - portal.zone.entranceZ) }))
          .filter(({ distance }) => distance < 8)
          .sort((a, b) => a.distance - b.distance)[0]?.portal || null;
        nearbyTown = zones
          .map((zone) => ({ zone, distance: Math.hypot(player.position.x - zone.townX, player.position.z - zone.townZ) }))
          .filter(({ distance }) => distance < 13)
          .sort((a, b) => a.distance - b.distance)[0]?.zone || null;
        interactButton.hidden = !nearbyTown && !nearbyEntrance;
        interactButton.textContent = nearbyEntrance ? 'ENTRAR A LA MAZMORRA' : 'HABLAR';
      }
      if (!activeDungeon) {
        const nextZone = zoneAt(player.position.x, player.position.z);
        if (nextZone !== currentZone) {
          currentZone = nextZone;
          zoneEyebrow.textContent = currentZone.kind;
          zoneName.textContent = currentZone.name;
          zoneDescription.textContent = currentZone.description;
          setCombatFeedback(`Nueva zona descubierta: ${currentZone.name}`, 2);
        }
      }
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
          + (side > 0 ? attackPose : attack?.type === 'ability' && selectedHeroId === 'mage' ? attackPose * .62 : blocking ? 1.05 : 0);
        arm.rotation.z = side > 0 ? attackTwist : attack?.type === 'ability' && selectedHeroId === 'mage' ? -attackTwist * .6 : blocking ? -.28 : 0;
        leg.rotation.x = -swing * side;
      }
      body.position.y = Math.abs(Math.sin(gait)) * .055 * Math.min(speed / 3.2, 1);
      body.position.z = -Math.max(0, attackPose) * .07;
      body.rotation.y = attackTwist * .45;
      if (!activeDungeon) updateChunks(player.position.x, player.position.z);
      updateCamera(dt);
      sun.position.set(player.position.x - 35, player.position.y + 55, player.position.z + 30);
      sun.target.position.copy(player.position);
    }
    renderer.render(scene, camera);
    needsRender = false;
  });
}
