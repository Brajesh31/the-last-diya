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
import { movePlayerWithCollision } from './world/player-collision';
import { installTouchControls } from './world/touch-controls';
import { GAME_CLIENT_VERSION, GAME_SERVER_URL, SESSION_STORAGE_KEY } from './production-config';

const root = document.getElementById('game')!;
const touchDevice = navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
let lowQualityMode = touchDevice;
const scene = new THREE.Scene();
const nightColor = new THREE.Color(0x080a0a);
const litColor = new THREE.Color(0x15110b);
const sceneFog = new THREE.Fog(nightColor, 18, 55);
scene.background = nightColor;
scene.fog = sceneFog;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, lowQualityMode ? 1 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = !lowQualityMode;
root.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x91a0b2, 0x17120c, 0.38);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xaabbd2, 1.15);
moon.position.set(-8, 12, 6);
moon.castShadow = true;
scene.add(moon);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x20211f, roughness: 0.92, metalness: 0.02 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 60), new THREE.MeshStandardMaterial({ color: 0x343432, roughness: 0.82, metalness: 0.03 }));
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

function applyGraphicsQuality(lowQuality: boolean) {
  lowQualityMode = lowQuality;
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowQualityMode ? 1 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !lowQualityMode;
  atmosphereVfx.setLowQuality(lowQualityMode);
  root.dataset.graphicsQuality = lowQualityMode ? 'low' : 'high';
  if (graphicsQualityToggle) {
    graphicsQualityToggle.textContent = lowQualityMode ? 'Graphics: Low' : 'Graphics: High';
    graphicsQualityToggle.setAttribute('aria-pressed', String(lowQualityMode));
    graphicsQualityToggle.setAttribute('aria-label', lowQualityMode ? 'Switch to high graphics quality' : 'Switch to low graphics quality');
  }
}

let graphicsQualityToggle: HTMLButtonElement | null = null;

const diya = new THREE.Group();
const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b5a35, roughness: 0.8 }));
bowl.scale.y = 0.35;
diya.add(bowl);
const mainFlameMaterial = new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0 });
const flame = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mainFlameMaterial);
flame.scale.set(0.7, 1.8, 0.7);
flame.position.y = 0.22;
diya.add(flame);
diya.position.set(0, 0.3, -4);
scene.add(diya);
const diyaLight = new THREE.PointLight(0xffb84d, 0, 8);
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
const REMOTE_AVATAR_LOD_ENABLE_AT = 8;
const REMOTE_AVATAR_LOD_DISABLE_AT = 5;
let remoteAvatarLodEnabled = false;
function makeRemotePlayer(id: PlayerId, lowDetail = remoteAvatarLodEnabled) { return createPlayerCharacter(id, false, lowDetail); }
function setRemoteAvatarDetailMode(lowDetail: boolean) {
  if (remoteAvatarLodEnabled === lowDetail) return;
  remoteAvatarLodEnabled = lowDetail;
  for (const [id, remote] of remotePlayers) {
    const visual = makeRemotePlayer(id, lowDetail);
    const mesh = visual.group;
    mesh.position.copy(remote.mesh.position);
    mesh.rotation.y = remote.mesh.rotation.y;
    scene.remove(remote.mesh);
    remote.visual.dispose();
    scene.add(mesh);
    remote.mesh = mesh;
    remote.visual = visual;
  }
}
function updateRemoteAvatarDetailMode() {
  if (!remoteAvatarLodEnabled && remotePlayers.size >= REMOTE_AVATAR_LOD_ENABLE_AT) setRemoteAvatarDetailMode(true);
  else if (remoteAvatarLodEnabled && remotePlayers.size <= REMOTE_AVATAR_LOD_DISABLE_AT) setRemoteAvatarDetailMode(false);
}

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
  'share-the-light': { threshold: 100, text: 'The street is bright again. Do not let the flame stop with you. Share it.' },
};

interface PickupDefinition { id: string; x: number; z: number; label: string; }
interface PickupEntry { definition: PickupDefinition; mesh: THREE.Mesh; collected: boolean; }
const pickupDefinitions: PickupDefinition[] = [
  { id: 'sharma-doorway-01', x: -2.5, z: -1, label: '2 wicks' },
  { id: 'market-stall-01', x: 2.5, z: -8, label: 'diya' },
  { id: 'market-stall-02', x: -2.5, z: -9.5, label: 'diya' },
  { id: 'market-stall-03', x: 2.5, z: -11, label: 'diya' },
  { id: 'temple-memory-01', x: 2.5, z: -17, label: 'memory fragment' },
];
const pickups = new Map<string, PickupEntry>();
for (const definition of pickupDefinitions) {
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0xd5a85f, emissive: 0x5a3512, emissiveIntensity: 0.8 }));
  mesh.position.set(definition.x, 0.35, definition.z);
  scene.add(mesh);
  pickups.set(definition.id, { definition, mesh, collected: false });
}
const memoryMarker = createMemoryMarker(scene, new THREE.Vector3(2.5, 0.9, -17));
const darkGate = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.4), new THREE.MeshStandardMaterial({ color: 0x17130f, emissive: 0x24160a, emissiveIntensity: 0.5 }));
darkGate.position.set(0, 2, -19.5);
scene.add(darkGate);
const memorySequence = createMemorySequence();
const celebration = createCelebration(scene);

const hud = document.createElement('div');
hud.innerHTML = `<div class="hud">
  <div class="hud-heading"><strong>THE LAST DIYA</strong><span id="connection" class="connection-state">CONNECTING</span></div>
  <div class="light-readout"><span id="light">LIGHT ${LIGHT_LEVEL_START}%</span><span id="light-stage">THE STREET IS QUIET</span></div>
  <div class="light-track" role="progressbar" aria-label="Shared Light Level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${LIGHT_LEVEL_START}"><span id="light-fill"></span></div>
  <small>WASD / Arrow keys · E · Interact</small>
</div>`;
document.body.appendChild(hud);
const style = document.createElement('style');
style.textContent = `body{margin:0;overflow:hidden;background:#080a0a;font-family:system-ui;color:#f4f0e8}.hud{position:fixed;top:22px;left:22px;display:grid;gap:10px;padding:15px 16px;background:#0c0d0de8;border:1px solid #34352f;border-radius:12px;width:min(260px,calc(100vw - 60px));box-sizing:border-box;backdrop-filter:blur(12px)}.hud-heading,.light-readout{display:flex;align-items:center;justify-content:space-between;gap:12px}.hud-heading strong{font-size:12px;letter-spacing:.12em}.hud .connection-state{font-size:10px;color:#b2b5aa;letter-spacing:.08em}.light-readout{align-items:flex-start;flex-direction:column;gap:3px}.light-readout #light{font-size:19px;font-weight:700;color:#f1b85b;font-variant-numeric:tabular-nums}.light-readout #light-stage{font-size:10px;letter-spacing:.09em;color:#b8b3a6}.light-track{height:5px;overflow:hidden;background:#292a26;border-radius:99px}.light-track span{display:block;width:0;height:100%;background:#e8b45b;border-radius:99px;transition:width .35s ease}.hud small{color:#9c9e99;font-size:11px}.prompt{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);padding:12px 16px;background:#0c0d0de8;border:1px solid #30312e;border-radius:8px;max-width:calc(100vw - 36px);box-sizing:border-box;text-align:center;backdrop-filter:blur(12px)}@media(max-width:640px){.hud{top:10px;left:10px;width:min(235px,calc(100vw - 20px));padding:12px}.inventory-panel{right:10px!important;top:10px!important;min-width:unset!important;max-width:128px}.quest-panel{top:auto!important;bottom:86px;left:10px!important;min-width:unset!important;width:min(235px,calc(100vw - 20px));box-sizing:border-box}.dialogue-panel{bottom:14px!important}.prompt{bottom:66px;font-size:12px;padding:9px 12px;max-width:calc(100vw - 20px)}}`;
document.head.appendChild(style);

if (touchDevice) {
  graphicsQualityToggle = document.createElement('button');
  graphicsQualityToggle.type = 'button';
  graphicsQualityToggle.className = 'graphics-quality-toggle';
  graphicsQualityToggle.addEventListener('click', () => applyGraphicsQuality(!lowQualityMode));
  graphicsQualityToggle.textContent = lowQualityMode ? 'Graphics: Low' : 'Graphics: High';
  graphicsQualityToggle.setAttribute('aria-pressed', String(lowQualityMode));
  graphicsQualityToggle.setAttribute('aria-label', lowQualityMode ? 'Switch to high graphics quality' : 'Switch to low graphics quality');
  graphicsQualityToggle.title = 'Reduce rendering load on mobile devices';
  const graphicsStyle = document.createElement('style');
  graphicsStyle.textContent = `.graphics-quality-toggle{position:fixed;top:calc(12px + env(safe-area-inset-top,0px));right:calc(12px + env(safe-area-inset-right,0px));z-index:80;padding:9px 12px;border:1px solid #6b614e;border-radius:10px;background:#11120fe8;color:#f4f0e8;font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.02em;box-shadow:0 3px 12px #0005;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.graphics-quality-toggle:active{background:#51412a;border-color:#e4b35f}.graphics-quality-toggle:focus-visible{outline:2px solid #e4b35f;outline-offset:3px}`;
  document.head.appendChild(graphicsStyle);
  document.body.appendChild(graphicsQualityToggle);
}
applyGraphicsQuality(lowQualityMode);

installGameUiStyles();
const ui = createGameUi();
ui.setTouchMode(touchDevice);
const prompt = document.createElement('div');
prompt.className = 'prompt';
prompt.textContent = 'Welcome. Find the first diya.';
document.body.appendChild(prompt);

let socket: WebSocket | null = null;
let reconnectTimer: number | undefined;
let reconnectAttempt = 0;
let currentPlayerId: PlayerId | null = null;
let sessionToken = localStorage.getItem(SESSION_STORAGE_KEY);
let inventory: InventoryItemState[] = [];
let quests: QuestState[] = [];
let lightLevel = LIGHT_LEVEL_START;
let darkDistrictUnlocked = false;
let finalEventActive = false;

function setConnectionState(state: 'CONNECTING' | 'ONLINE' | 'RECONNECTING' | 'OFFLINE') {
  const connection = document.getElementById('connection');
  if (!connection) return;
  connection.textContent = state;
  connection.dataset.state = state.toLowerCase();
}
function send(message: Parameters<typeof encodeMessage>[0]) { if (socket?.readyState === WebSocket.OPEN) socket.send(encodeMessage(message)); }
function setLightLevel(value: number) {
  lightLevel = clampLightLevel(value);
  ambientAudio.setLightLevel(lightLevel);
  document.getElementById('light')!.textContent = `LIGHT ${lightLevel}%`;
  document.getElementById('light-fill')!.style.width = `${lightLevel}%`;
  document.querySelector('.light-track')!.setAttribute('aria-valuenow', String(lightLevel));
  const ambience = applyNeighbourhoodLight(neighbourhood, lightLevel);
  hemi.intensity = 0.45 + ambience.targetExposure * 0.25;
  scene.background = lightLevel > 0 ? litColor : nightColor;
  sceneFog.color = lightLevel > 0 ? litColor : nightColor;
  sceneFog.near = 20 - ambience.street * 2;
  sceneFog.far = 60 + ambience.homes * 15;
  darkDistrictUnlocked = lightLevel >= DARK_DISTRICT_UNLOCK_LEVEL;
}
function applyWorldState(level: number, unlockedDistricts: string[]) {
  setLightLevel(level);
  darkDistrictUnlocked = unlockedDistricts.includes('dark-district');
  darkGate.visible = !darkDistrictUnlocked;
}
function setMainDiyaLit(active: boolean) { mainFlameMaterial.opacity = active ? 1 : 0; diyaLight.intensity = active ? 1.5 : 0; }
function applyFinalEventState(active: boolean, completed: boolean) { finalEventActive = active; celebration.setVisible(active || completed); }
function clearRemotePlayers() { for (const remote of remotePlayers.values()) { scene.remove(remote.mesh); remote.visual.dispose(); } remotePlayers.clear(); updateRemoteAvatarDetailMode(); }
function addRemotePlayer(id: PlayerId, transform: PlayerTransform) {
  if (id === currentPlayerId) return;
  const visual = makeRemotePlayer(id);
  visual.group.position.set(transform.x, transform.y, transform.z);
  visual.group.rotation.y = transform.rotation;
  scene.add(visual.group);
  remotePlayers.set(id, { mesh: visual.group, visual, target: new THREE.Vector3(transform.x, transform.y, transform.z), rotation: transform.rotation });
  updateRemoteAvatarDetailMode();
}
function handleServerMessage(message: ServerMessage) {
  if (message.type === 'session_assigned') {
    sessionToken = message.sessionToken;
    localStorage.setItem(SESSION_STORAGE_KEY, sessionToken);
    currentPlayerId = message.playerId;
    player.position.set(message.transform.x, message.transform.y, message.transform.z);
    player.rotation.y = message.transform.rotation;
    prompt.textContent = message.restored ? 'Welcome back. Your flame, inventory and quest progress were restored.' : 'Welcome. Find the first diya.';
    return;
  }
  if (message.type === 'room_snapshot') {
    clearRemotePlayers();
    setMainDiyaLit(message.litTargets.includes('diya-main-street-01'));
    applyWorldState(message.lightLevel, message.unlockedDistricts);
    for (const entry of message.players) addRemotePlayer(entry.playerId, entry.transform);
    for (const [id, pickup] of pickups) { pickup.collected = message.pickedTargets.includes(id); pickup.mesh.visible = !pickup.collected; }
    if (message.memory?.active) memorySequence.open();
    if (message.finalEvent) applyFinalEventState(message.finalEvent.active, message.finalEvent.completed);
    return;
  }
  if (message.type === 'player_spawned') { addRemotePlayer(message.playerId, message.transform); return; }
  if (message.type === 'player_state') { const remote = remotePlayers.get(message.playerId); if (remote) { remote.target.set(message.transform.x, message.transform.y, message.transform.z); remote.rotation = message.transform.rotation; } return; }
  if (message.type === 'player_left') { const remote = remotePlayers.get(message.playerId); if (remote) { scene.remove(remote.mesh); remote.visual.dispose(); remotePlayers.delete(message.playerId); updateRemoteAvatarDetailMode(); } return; }
  if (message.type === 'light_update') { setLightLevel(message.level); return; }
  if (message.type === 'target_state') { if (message.targetId === 'diya-main-street-01') setMainDiyaLit(message.active); return; }
  if (message.type === 'interaction_result' && message.success) {
    if (message.targetId === 'diya-main-street-01') { setMainDiyaLit(true); prompt.textContent = 'Diya lit · Shared Light Level +10%'; }
    if (message.targetId === 'community-diya-01') prompt.textContent = 'The last diya is lit. The neighbourhood remembers.';
    setLightLevel(message.lightLevel);
    return;
  }
  if (message.type === 'inventory_update') { inventory = message.items; ui.setInventory(inventory); return; }
  if (message.type === 'quest_update') { quests = message.quests; ui.setQuests(quests); return; }
  if (message.type === 'pickup_result' && message.success) { const pickup = pickups.get(message.targetId); if (pickup) { pickup.collected = true; pickup.mesh.visible = false; } prompt.textContent = `Collected ${message.quantity} ${message.itemId.replace('_', ' ')}`; return; }
  if (message.type === 'flame_shared') { setLightLevel(message.lightLevel); prompt.textContent = message.fromPlayerId === currentPlayerId ? 'You shared your flame · +5% Light' : 'A nearby player shared their flame · +5% Light'; return; }
  if (message.type === 'world_state') { applyWorldState(message.lightLevel, message.unlockedDistricts); if (darkDistrictUnlocked) prompt.textContent = 'The Dark District is awake. The final path has opened.'; return; }
  if (message.type === 'memory_started') { memorySequence.open(); prompt.textContent = 'A forgotten memory has surfaced.'; return; }
  if (message.type === 'memory_completed') { memorySequence.close(); prompt.textContent = 'Memory restored. The path beyond the gate is waiting.'; return; }
  if (message.type === 'final_event_started') { applyFinalEventState(true, false); prompt.textContent = 'The neighbourhood is alive again.'; return; }
  if (message.type === 'final_event_state') { applyFinalEventState(message.event.active, message.event.completed); return; }
  if (message.type === 'error') prompt.textContent = message.message;
}
function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  setConnectionState(reconnectAttempt > 0 ? 'RECONNECTING' : 'CONNECTING');
  try { socket = new WebSocket(GAME_SERVER_URL); }
  catch { setConnectionState('OFFLINE'); scheduleReconnect(); return; }
  socket.addEventListener('open', () => {
    reconnectAttempt = 0;
    setConnectionState('ONLINE');
    prompt.textContent = sessionToken ? 'Reconnected. Restoring your neighbourhood...' : 'Welcome. Joining the neighbourhood...';
    send({ type: 'hello', clientVersion: GAME_CLIENT_VERSION, sessionToken });
    send({ type: 'join_room', roomId: 'main-street' });
  });
  socket.addEventListener('message', (event) => { const message = decodeMessage(String(event.data)); if (message && 'type' in message) handleServerMessage(message as ServerMessage); });
  socket.addEventListener('error', () => { setConnectionState('OFFLINE'); });
  socket.addEventListener('close', () => { socket = null; setConnectionState('OFFLINE'); prompt.textContent = 'Server disconnected. Retrying automatically...'; scheduleReconnect(); });
}
function scheduleReconnect() {
  if (reconnectTimer !== undefined) return;
  const delay = Math.min(10_000, 750 * 2 ** Math.min(reconnectAttempt, 4));
  reconnectAttempt += 1;
  reconnectTimer = window.setTimeout(() => { reconnectTimer = undefined; connect(); }, delay);
}
function playerTransform(): PlayerTransform { return { x: player.position.x, y: player.position.y, z: player.position.z, rotation: player.rotation.y }; }
function interact() {
  if (memorySequence.isOpen()) { send({ type: 'memory_continue', memoryId: 'temple-memory-01' }); return; }
  const nearDiya = isNear(player.position, diya.position, 1.5);
  if (nearDiya) { send({ type: 'interact_request', targetId: 'diya-main-street-01' }); return; }
  if (darkDistrictUnlocked && lightLevel >= FINAL_EVENT_LEVEL && isNear(player.position, communityDiya.position, 2.2)) { send({ type: 'interact_request', targetId: 'community-diya-01' }); return; }
  const nearbyPickup = [...pickups.values()].find((entry) => !entry.collected && isNear(player.position, entry.mesh.position, 1.5));
  if (nearbyPickup) { send({ type: 'pickup_request', targetId: nearbyPickup.definition.id }); return; }
  const nearbyRemote = [...remotePlayers.entries()].find(([, remote]) => isNear(player.position, remote.target, 2.5));
  if (nearbyRemote) { send({ type: 'share_flame_request', targetPlayerId: nearbyRemote[0] }); return; }
  const nearest = npcGroups.find((entry) => isNear(player.position, entry.group.position, 1.5));
  if (nearest) { const context = npcContextDialogue[nearest.npc.id]; const lines = [...nearest.npc.dialogue]; if (context && lightLevel >= context.threshold) lines.push({ speaker: nearest.npc.name, text: context.text }); const line = lines[nearest.index % lines.length]; ui.showDialogue(line.speaker, line.text); nearest.index = (nearest.index + 1) % lines.length; }
}
function handleInteractionInput() { ambientAudio.start(); if (!ui.dialogue.hidden) { ui.hideDialogue(); return; } interact(); }
addEventListener('keydown', (event) => { if (event.key.toLowerCase() !== 'e' || event.repeat) return; event.preventDefault(); handleInteractionInput(); });
const touchControls = installTouchControls(keys, handleInteractionInput);

connect();

// Keep the existing deterministic E2E bridge below this point in the source tree.
