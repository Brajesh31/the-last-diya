import * as THREE from 'three';
import { clampLightLevel, isNear, NPCS } from '@the-last-diya/game-core';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';
import { DARK_DISTRICT_UNLOCK_LEVEL, FINAL_EVENT_LEVEL, LIGHT_LEVEL_START } from '@the-last-diya/shared';
import type { InventoryItemState, PlayerId, PlayerTransform, QuestState, ServerMessage } from '@the-last-diya/shared';
import { createGameUi, installGameUiStyles } from './game-ui';
import { createCelebration } from './world/celebration';
import { createMemoryMarker, createMemorySequence } from './world/memory-sequence';
import { applyNeighbourhoodLight, createNeighbourhoodState } from './world/neighbourhood-state';
import { createAmbientAudio } from './world/ambient-audio';
import { createEnvironmentStory } from './world/environment-story';
import { createAtmosphereVfx } from './world/atmosphere-vfx';
import { createNPCActivity } from './world/npc-activity';
import { createNPCCharacter } from './world/npc-character';
import { createPlayerCharacter, type PlayerCharacterVisual } from './world/player-character';
import { createNeighbourhoodProps } from './world/neighbourhood-props';

const root = document.getElementById('game')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080a0a);
scene.fog = new THREE.Fog(0x080a0a, 18, 55);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
root.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x91a0b2, 0x17120c, 0.45);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xaabbd2, 1);
moon.position.set(-8, 12, 6);
moon.castShadow = true;
scene.add(moon);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x20211f, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 60), new THREE.MeshStandardMaterial({ color: 0x343432, roughness: 1 }));
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
scene.add(road);
for (let i = -18; i <= 18; i += 6) for (const x of [-6, 6]) {
  const house = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 4.5), new THREE.MeshStandardMaterial({ color: 0x4a4037 }));
  house.position.set(x, 1.6, i);
  house.castShadow = true;
  scene.add(house);
}
const neighbourhood = createNeighbourhoodState(scene);
const neighbourhoodProps = createNeighbourhoodProps(scene);
const ambientAudio = createAmbientAudio();
const environmentStory = createEnvironmentStory(scene);
const atmosphereVfx = createAtmosphereVfx(scene);

const diya = new THREE.Group();
const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b5a35, roughness: 0.8 }));
bowl.scale.y = 0.35;
diya.add(bowl);
const flame = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffc857 }));
flame.scale.set(0.7, 1.8, 0.7);
flame.position.y = 0.22;
diya.add(flame);
diya.position.set(0, 0.3, -4);
scene.add(diya);
const diyaLight = new THREE.PointLight(0xffb84d, 1.8, 8);
diyaLight.position.copy(diya.position).add(new THREE.Vector3(0, 1, 0));
scene.add(diyaLight);

const communityDiya = new THREE.Group();
const communityBowl = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b5a35, roughness: 0.8 }));
communityBowl.scale.y = 0.35;
communityDiya.add(communityBowl);
const communityFlame = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffc857 }));
communityFlame.scale.set(0.7, 2.2, 0.7);
communityFlame.position.y = 0.3;
communityDiya.add(communityFlame);
communityDiya.position.set(0, 0.45, -24);
scene.add(communityDiya);
const communityLight = new THREE.PointLight(0xffb84d, 0, 12);
communityLight.position.copy(communityDiya.position).add(new THREE.Vector3(0, 1, 0));
scene.add(communityLight);

const playerCharacter = createPlayerCharacter('local-player', true);
const player = playerCharacter.group;
player.position.set(0, 0.75, 4);
scene.add(player);
const remotePlayers = new Map<PlayerId, { mesh: THREE.Group; visual: PlayerCharacterVisual; target: THREE.Vector3; rotation: number }>();
function makeRemotePlayer(id: PlayerId) { return createPlayerCharacter(id, false); }

const npcCharacters = NPCS.map((npc) => createNPCCharacter(npc));
const npcGroups = NPCS.map((npc, index) => {
  const group = npcCharacters[index].group;
  group.position.set(npc.position.x, 0, npc.position.z);
  scene.add(group);
  return { npc, group, index: 0, order: index, home: group.position.clone(), target: group.position.clone(), speed: 0.5, phase: 0, active: false };
});
const npcActivity = createNPCActivity(npcGroups);
const npcContextDialogue: Record<string, { threshold: number; text: string }> = {
  'sharma-aunty': { threshold: 35, text: 'Look at the lamps. Every home feels a little closer tonight.' },
  'mithai-seller': { threshold: 50, text: 'The market is waking up. I saved the first box of sweets for the neighbours.' },
  'chai-seller': { threshold: 40, text: 'The kettle sounds different when people stop by again.' },
  'temple-caretaker': { threshold: 65, text: 'You have brought enough light for an old memory to be seen.' },
  'unknown-stranger': { threshold: 85, text: 'The last district is opening. Some memories return only when the light is shared.' },
};

const pickupDefinitions = [
  { id: 'sharma-doorway-01', x: -2.5, z: -1, label: '2 wicks' },
  { id: 'market-stall-01', x: 2.5, z: -8, label: 'diya' },
  { id: 'market-stall-02', x: -2.5, z: -9.5, label: 'diya' },
  { id: 'market-stall-03', x: 2.5, z: -11, label: 'diya' },
  { id: 'temple-memory-01', x: 2.5, z: -17, label: 'memory fragment' },
];
const pickups = new Map(pickupDefinitions.map((definition) => {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0xd5a85f, emissive: 0x5a3512, emissiveIntensity: 0.8 }));
  mesh.position.set(definition.x, 0.35, definition.z);
  scene.add(mesh);
  return [definition.id, { definition, mesh, collected: false }] as const;
}));
const memoryMarker = createMemoryMarker(scene, new THREE.Vector3(2.5, 0.9, -17));
const darkGate = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.4), new THREE.MeshStandardMaterial({ color: 0x17130f, emissive: 0x24160a, emissiveIntensity: 0.5 }));
darkGate.position.set(0, 2, -19.5);
scene.add(darkGate);
const memorySequence = createMemorySequence();
const celebration = createCelebration(scene);

const hud = document.createElement('div');
hud.innerHTML = `<div class="hud"><strong>THE LAST DIYA</strong><span id="connection">CONNECTING</span><span id="light">LIGHT ${LIGHT_LEVEL_START}%</span><small>WASD / Arrow keys · E · Interact</small></div>`;
document.body.appendChild(hud);
const style = document.createElement('style');
style.textContent = `body{margin:0;overflow:hidden;background:#080a0a;font-family:system-ui;color:#f4f0e8}.hud{position:fixed;top:22px;left:22px;display:grid;gap:7px;padding:14px 16px;background:#0c0d0dcc;border:1px solid #30312e;border-radius:10px;min-width:190px}.hud span{font-size:13px;color:#f1b85b}.hud small{color:#9c9e99}.prompt{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);padding:12px 16px;background:#0c0d0de8;border:1px solid #30312e;border-radius:8px}`;
document.head.appendChild(style);
installGameUiStyles();
const ui = createGameUi();
const prompt = document.createElement('div');
prompt.className = 'prompt';
prompt.textContent = 'Connecting to the neighbourhood...';
document.body.appendChild(prompt);

const keys = new Set<string>();
addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
  ambientAudio.start();
});
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

let lightLevel = LIGHT_LEVEL_START;
let litLocally = false;
let socket: WebSocket | null = null;
let lastNetworkSend = 0;
let reconnectTimer: number | undefined;
let inventory: InventoryItemState[] = [];
let quests: QuestState[] = [];
let currentPlayerId: PlayerId | null = null;
let darkDistrictUnlocked = false;
let finalEventActive = false;
let sessionToken = localStorage.getItem('the-last-diya-session') ?? undefined;

function setLightLevel(value: number) {
  lightLevel = clampLightLevel(value);
  ambientAudio.setLightLevel(lightLevel);
  document.getElementById('light')!.textContent = `LIGHT ${lightLevel}%`;
  const ambience = applyNeighbourhoodLight(neighbourhood, lightLevel);
  hemi.intensity = 0.45 + ambience.targetExposure * 0.25;
  scene.background.set(lightLevel > 0 ? 0x15110b : 0x080a0a);
  scene.fog = new THREE.Fog(lightLevel > 0 ? 0x15110b : 0x080a0a, 20 - ambience.street * 2, 60 + ambience.homes * 15);
  diyaLight.intensity = 1.8 + lightLevel / 20;
  const targetDark = lightLevel >= DARK_DISTRICT_UNLOCK_LEVEL;
  if (targetDark && !darkDistrictUnlocked) prompt.textContent = 'The Dark District is awake. The final path has opened.';
}
function send(message: Parameters<typeof encodeMessage>[0]) { if (socket?.readyState === WebSocket.OPEN) socket.send(encodeMessage(message)); }
function clearRemotePlayers() {
  for (const remote of remotePlayers.values()) {
    scene.remove(remote.mesh);
    remote.visual.dispose();
  }
  remotePlayers.clear();
}
function addRemotePlayer(id: PlayerId, transform: PlayerTransform) {
  if (id === currentPlayerId || remotePlayers.has(id)) return;
  const visual = makeRemotePlayer(id);
  const mesh = visual.group;
  mesh.position.set(transform.x, transform.y, transform.z);
  mesh.rotation.y = transform.rotation;
  scene.add(mesh);
  remotePlayers.set(id, { mesh, visual, target: new THREE.Vector3(transform.x, transform.y, transform.z), rotation: transform.rotation });
}
function applyWorldState(level: number, unlocked: string[]) {
  setLightLevel(level);
  darkDistrictUnlocked = unlocked.includes('dark-district') || level >= DARK_DISTRICT_UNLOCK_LEVEL;
  const material = darkGate.material as THREE.MeshStandardMaterial;
  material.color.set(darkDistrictUnlocked ? 0x7b4c1d : 0x17130f);
  material.emissive.set(darkDistrictUnlocked ? 0x5a2e0b : 0x24160a);
  material.emissiveIntensity = darkDistrictUnlocked ? 1.2 : 0.5;
  darkGate.visible = !darkDistrictUnlocked;
  memoryMarker.visible = !darkDistrictUnlocked;
}
function applyFinalEventState(active: boolean, completed: boolean) {
  finalEventActive = active || completed;
  if (active) celebration.trigger();
  communityLight.intensity = active || completed ? 6 : 0;
}
function handleServerMessage(message: ServerMessage) {
  if (message.type === 'session_assigned') {
    sessionToken = message.sessionToken;
    localStorage.setItem('the-last-diya-session', sessionToken);
    currentPlayerId = message.playerId;
    player.position.set(message.transform.x, message.transform.y, message.transform.z);
    player.rotation.y = message.transform.rotation;
    if (message.restored) prompt.textContent = 'Welcome back. Your flame, inventory and quest progress were restored.';
    return;
  }
  if (message.type === 'room_snapshot') {
    clearRemotePlayers();
    applyWorldState(message.lightLevel, message.unlockedDistricts);
    for (const entry of message.players) addRemotePlayer(entry.playerId, entry.transform);
    for (const [id, pickup] of pickups) { pickup.collected = message.pickedTargets.includes(id); pickup.mesh.visible = !pickup.collected; }
    if (message.memory?.active) memorySequence.open();
    if (message.finalEvent) applyFinalEventState(message.finalEvent.active, message.finalEvent.completed);
    return;
  }
  if (message.type === 'player_spawned') { addRemotePlayer(message.playerId, message.transform); return; }
  if (message.type === 'player_state') { const remote = remotePlayers.get(message.playerId); if (remote) { remote.target.set(message.transform.x, message.transform.y, message.transform.z); remote.rotation = message.transform.rotation; } return; }
  if (message.type === 'player_left') { const remote = remotePlayers.get(message.playerId); if (remote) { scene.remove(remote.mesh); remote.visual.dispose(); remotePlayers.delete(message.playerId); } return; }
  if (message.type === 'light_update') { setLightLevel(message.level); if (message.level >= 10) litLocally = true; return; }
  if (message.type === 'interaction_result' && message.success) {
    if (message.targetId === 'diya-main-street-01') { litLocally = true; prompt.textContent = 'Diya lit · Shared Light Level +10%'; }
    if (message.targetId === 'community-diya-01') prompt.textContent = 'The last diya is lit. The neighbourhood remembers.';
    setLightLevel(message.lightLevel);
    return;
  }
  if (message.type === 'inventory_update') { inventory = message.items; ui.setInventory(inventory); return; }
  if (message.type === 'quest_update') { quests = message.quests; ui.setQuests(quests); return; }
  if (message.type === 'pickup_result' && message.success) {
    const pickup = pickups.get(message.targetId);
    if (pickup) { pickup.collected = true; pickup.mesh.visible = false; }
    prompt.textContent = `Collected ${message.quantity} ${message.itemId.replace('_', ' ')}`;
    return;
  }
  if (message.type === 'flame_shared') { setLightLevel(message.lightLevel); prompt.textContent = message.fromPlayerId === currentPlayerId ? 'You shared your flame · +5% Light' : 'A nearby player shared their flame · +5% Light'; return; }
  if (message.type === 'world_state') { applyWorldState(message.lightLevel, message.unlockedDistricts); if (darkDistrictUnlocked) prompt.textContent = 'The Dark District is awake. The final path has opened.'; return; }
  if (message.type === 'memory_started') { memorySequence.open(); prompt.textContent = 'A forgotten memory has surfaced.'; return; }
  if (message.type === 'memory_completed') { memorySequence.close(); prompt.textContent = 'Memory restored. The path beyond the gate is waiting.'; return; }
  if (message.type === 'final_event_started') { applyFinalEventState(true, false); prompt.textContent = 'The neighbourhood is alive again.'; return; }
  if (message.type === 'final_event_state') { applyFinalEventState(message.event.active, message.event.completed); return; }
  if (message.type === 'error') prompt.textContent = message.message;
}
function connect() {
  const configured = import.meta.env.VITE_GAME_SERVER_URL as string | undefined;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(configured || `${protocol}//${location.hostname}:8787`);
  const connection = document.getElementById('connection')!;
  connection.textContent = 'CONNECTING';
  socket.addEventListener('open', () => {
    connection.textContent = 'ONLINE';
    prompt.textContent = sessionToken ? 'Reconnecting to your neighbourhood...' : 'Welcome. Joining the neighbourhood...';
    send({ type: 'hello', clientVersion: '0.4.0', sessionToken });
    send({ type: 'join_room', roomId: 'main-street' });
  });
  socket.addEventListener('message', (event) => { const message = decodeMessage(String(event.data)); if (message && 'type' in message) handleServerMessage(message as ServerMessage); });
  socket.addEventListener('close', () => {
    connection.textContent = 'OFFLINE';
    prompt.textContent = 'Server disconnected. Retrying...';
    if (reconnectTimer === undefined) reconnectTimer = window.setTimeout(() => { reconnectTimer = undefined; connect(); }, 1500);
  });
}
function playerTransform(): PlayerTransform { return { x: player.position.x, y: player.position.y, z: player.position.z, rotation: player.rotation.y }; }
function interact() {
  if (memorySequence.isOpen()) { send({ type: 'memory_continue', memoryId: 'temple-memory-01' }); return; }
  const nearDiya = isNear(player.position, diya.position, 1.5);
  if (nearDiya && !litLocally) { send({ type: 'interact_request', targetId: 'diya-main-street-01' }); return; }
  if (darkDistrictUnlocked && lightLevel >= FINAL_EVENT_LEVEL && isNear(player.position, communityDiya.position, 2.2)) { send({ type: 'interact_request', targetId: 'community-diya-01' }); return; }
  const nearbyPickup = [...pickups.values()].find((entry) => !entry.collected && isNear(player.position, entry.mesh.position, 1.5));
  if (nearbyPickup) { send({ type: 'pickup_request', targetId: nearbyPickup.definition.id }); return; }
  const nearbyRemote = [...remotePlayers.entries()].find(([, remote]) => isNear(player.position, remote.mesh.position, 2.5));
  if (nearbyRemote) { send({ type: 'share_flame_request', targetPlayerId: nearbyRemote[0] }); return; }
  const nearest = npcGroups.find((entry) => isNear(player.position, entry.group.position, 1.5));
  if (nearest) {
    const context = npcContextDialogue[nearest.npc.id];
    const lines = [...nearest.npc.dialogue];
    if (context && lightLevel >= context.threshold) lines.push({ speaker: nearest.npc.name, text: context.text });
    const line = lines[nearest.index % lines.length];
    ui.showDialogue(line.speaker, line.text);
    nearest.index = (nearest.index + 1) % lines.length;
  }
}
addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() !== 'e' || event.repeat) return;
  if (!ui.dialogue.hidden) { ui.hideDialogue(); return; }
  interact();
});

let previousTime = performance.now();
function update(now: number) {
  const deltaSeconds = Math.min((now - previousTime) / 1000, 0.05);
  previousTime = now;
  const lockedByMemory = memorySequence.isOpen();
  let playerMoving = false;
  if (!lockedByMemory) {
    const direction = new THREE.Vector3((keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), 0, (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0));
    if (direction.lengthSq() > 0) {
      playerMoving = true;
      direction.normalize();
      player.position.addScaledVector(direction, 6 * deltaSeconds);
      player.rotation.y = Math.atan2(direction.x, direction.z);
      player.position.x = THREE.MathUtils.clamp(player.position.x, -3.2, 3.2);
      player.position.z = THREE.MathUtils.clamp(player.position.z, darkDistrictUnlocked ? -27 : -19, darkDistrictUnlocked ? 19 : -0.01);
    }
  }
  const near = isNear(player.position, diya.position, 1.5);
  const finalNear = darkDistrictUnlocked && lightLevel >= FINAL_EVENT_LEVEL && isNear(player.position, communityDiya.position, 2.2);
  const pickup = [...pickups.values()].find((entry) => !entry.collected && isNear(player.position, entry.mesh.position, 1.5));
  const remote = [...remotePlayers.values()].find((entry) => isNear(player.position, entry.mesh.position, 2.5));
  const nearNpc = npcGroups.find((entry) => isNear(player.position, entry.group.position, 1.5));
  if (ui.dialogue.hidden && !lockedByMemory) prompt.textContent = near && !litLocally ? 'Press E to light the diya' : finalNear && !finalEventActive ? 'Press E to light the community diya' : pickup ? `Press E to collect ${pickup.definition.label}` : remote ? 'Press E to share your flame' : nearNpc ? `Press E to talk to ${nearNpc.npc.name}` : darkDistrictUnlocked ? 'The Dark District remembers' : `Shared Light Level ${lightLevel}%`;
  if (now - lastNetworkSend > 100 && !lockedByMemory) { send({ type: 'player_state', transform: playerTransform() }); lastNetworkSend = now; }
  playerCharacter.update(lightLevel, now / 1000, deltaSeconds, playerMoving);
  for (const remoteEntry of remotePlayers.values()) {
    const remoteMoving = remoteEntry.mesh.position.distanceToSquared(remoteEntry.target) > 0.0025;
    remoteEntry.visual.update(lightLevel, now / 1000, deltaSeconds, remoteMoving);
    remoteEntry.mesh.position.lerp(remoteEntry.target, 0.18);
    remoteEntry.mesh.rotation.y = THREE.MathUtils.lerp(remoteEntry.mesh.rotation.y, remoteEntry.rotation, 0.18);
  }
  npcActivity.update(lightLevel, now / 1000, deltaSeconds);
  npcCharacters.forEach((character, index) => character.update(lightLevel, now / 1000, deltaSeconds, npcGroups[index].active));
  environmentStory.update(lightLevel, now / 1000);
  atmosphereVfx.update(lightLevel, deltaSeconds, now / 1000);
  neighbourhoodProps.update(lightLevel, now / 1000);
  communityFlame.rotation.y += deltaSeconds * 1.5;
  communityFlame.scale.y = 2.2 + Math.sin(now / 120) * 0.25;
  memorySequence.update(deltaSeconds);
  celebration.update(deltaSeconds);
  ambientAudio.update(deltaSeconds);
  camera.position.lerp(new THREE.Vector3(player.position.x + 6, 6.5, player.position.z + 8), 0.06);
  camera.lookAt(player.position.x, 1, player.position.z);
  renderer.render(scene, camera);
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
connect();
renderer.setAnimationLoop(update);
window.addEventListener('beforeunload', () => { memorySequence.dispose(); celebration.dispose(); environmentStory.dispose(); atmosphereVfx.dispose(); neighbourhoodProps.dispose(); npcCharacters.forEach((character) => character.dispose()); playerCharacter.dispose(); clearRemotePlayers(); ambientAudio.dispose(); });