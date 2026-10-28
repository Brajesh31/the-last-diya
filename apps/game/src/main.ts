import * as THREE from 'three';
import { clampLightLevel, isNear, NPCS } from '@the-last-diya/game-core';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';
import { LIGHT_LEVEL_START } from '@the-last-diya/shared';
import type { InventoryItemState, PlayerId, PlayerTransform, QuestState, ServerMessage } from '@the-last-diya/shared';
import { createGameUi, installGameUiStyles } from './game-ui';

const root = document.getElementById('game')!;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x080a0a); scene.fog = new THREE.Fog(0x080a0a, 18, 55);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; root.appendChild(renderer.domElement);
const hemi = new THREE.HemisphereLight(0x91a0b2, 0x17120c, 0.45); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xaabbd2, 1); moon.position.set(-8, 12, 6); moon.castShadow = true; scene.add(moon);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), new THREE.MeshStandardMaterial({ color: 0x20211f, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 42), new THREE.MeshStandardMaterial({ color: 0x343432, roughness: 1 })); road.rotation.x = -Math.PI / 2; road.position.y = 0.01; scene.add(road);
for (let i = -18; i <= 18; i += 6) for (const x of [-6, 6]) { const house = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 4.5), new THREE.MeshStandardMaterial({ color: 0x4a4037 })); house.position.set(x, 1.6, i); house.castShadow = true; scene.add(house); }

const diya = new THREE.Group();
const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b5a35, roughness: 0.8 })); bowl.scale.y = 0.35; diya.add(bowl);
const flame = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffc857 })); flame.scale.set(0.7, 1.8, 0.7); flame.position.y = 0.22; diya.add(flame); diya.position.set(0, 0.3, -4); scene.add(diya);
const diyaLight = new THREE.PointLight(0xffb84d, 1.8, 8); diyaLight.position.copy(diya.position).add(new THREE.Vector3(0, 1, 0)); scene.add(diyaLight);

const player = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.8, 4, 12), new THREE.MeshStandardMaterial({ color: 0xbcc7c0 })); player.position.set(0, 0.75, 4); player.castShadow = true; scene.add(player);
const remotePlayers = new Map<PlayerId, { mesh: THREE.Mesh; target: THREE.Vector3; rotation: number }>();
function makeRemotePlayer() { const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 4, 12), new THREE.MeshStandardMaterial({ color: 0x8f9b96 })); mesh.castShadow = true; scene.add(mesh); return mesh; }

const npcGroups = NPCS.map((npc) => { const group = new THREE.Group(); const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 12), new THREE.MeshStandardMaterial({ color: 0x9d8062 })); body.position.y = 0.7; group.add(body); group.position.set(npc.position.x, 0, npc.position.z); scene.add(group); return { npc, group, index: 0 }; });
const pickupDefinitions = [
  { id: 'sharma-doorway-01', x: -2.5, z: -1, label: '2 wicks' },
  { id: 'market-stall-01', x: 2.5, z: -8, label: 'diya' },
  { id: 'market-stall-02', x: -2.5, z: -9.5, label: 'diya' },
  { id: 'market-stall-03', x: 2.5, z: -11, label: 'diya' },
  { id: 'temple-memory-01', x: 2.5, z: -17, label: 'memory fragment' },
];
const pickups = new Map(pickupDefinitions.map((definition) => { const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: 0xd5a85f, emissive: 0x5a3512, emissiveIntensity: 0.8 }); mesh.position.set(definition.x, 0.35, definition.z); scene.add(mesh); return [definition.id, { definition, mesh, collected: false }] as const; }));
const darkGate = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.4), new THREE.MeshStandardMaterial({ color: 0x17130f, emissive: 0x24160a, emissiveIntensity: 0.5 })); darkGate.position.set(0, 2, -19.5); scene.add(darkGate);

const hud = document.createElement('div'); hud.innerHTML = `<div class="hud"><strong>THE LAST DIYA</strong><span id="connection">CONNECTING</span><span id="light">LIGHT ${LIGHT_LEVEL_START}%</span><small>WASD / Arrow keys · Move · E · Interact</small></div>`; document.body.appendChild(hud);
const style = document.createElement('style'); style.textContent = `body{margin:0;overflow:hidden;background:#080a0a;font-family:system-ui;color:#f4f0e8}.hud{position:fixed;top:22px;left:22px;display:grid;gap:7px;padding:14px 16px;background:#0c0d0dcc;border:1px solid #30312e;border-radius:10px;min-width:190px}.hud span{font-size:13px;color:#f1b85b}.hud small{color:#9c9e99}.prompt{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);padding:12px 16px;background:#0c0d0de8;border:1px solid #30312e;border-radius:8px}`; document.head.appendChild(style); installGameUiStyles();
const ui = createGameUi();
const prompt = document.createElement('div'); prompt.className = 'prompt'; prompt.textContent = 'Connecting to the neighbourhood...'; document.body.appendChild(prompt);
const keys = new Set<string>(); addEventListener('keydown', (event) => keys.add(event.key.toLowerCase())); addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
let lightLevel = LIGHT_LEVEL_START; let litLocally = false; let socket: WebSocket | null = null; let lastNetworkSend = 0; let reconnectTimer: number | undefined; let inventory: InventoryItemState[] = []; let quests: QuestState[] = []; let currentPlayerId: PlayerId | null = null; let darkDistrictUnlocked = false;

function setLightLevel(value: number) { lightLevel = clampLightLevel(value); document.getElementById('light')!.textContent = `LIGHT ${lightLevel}%`; hemi.intensity = 0.45 + lightLevel / 300; scene.background.set(lightLevel > 0 ? 0x15110b : 0x080a0a); scene.fog = new THREE.Fog(lightLevel > 0 ? 0x15110b : 0x080a0a, 20, 60); diyaLight.intensity = 1.8 + lightLevel / 20; }
function send(message: Parameters<typeof encodeMessage>[0]) { if (socket?.readyState === WebSocket.OPEN) socket.send(encodeMessage(message)); }
function handleServerMessage(message: ServerMessage) {
  if (message.type === 'player_spawned') { if (remotePlayers.has(message.playerId)) return; const mesh = makeRemotePlayer(); mesh.position.set(message.transform.x, message.transform.y, message.transform.z); remotePlayers.set(message.playerId, { mesh, target: new THREE.Vector3(message.transform.x, message.transform.y, message.transform.z), rotation: message.transform.rotation }); return; }
  if (message.type === 'player_state') { const remote = remotePlayers.get(message.playerId); if (remote) { remote.target.set(message.transform.x, message.transform.y, message.transform.z); remote.rotation = message.transform.rotation; } return; }
  if (message.type === 'player_left') { const remote = remotePlayers.get(message.playerId); if (remote) { scene.remove(remote.mesh); remote.mesh.geometry.dispose(); (remote.mesh.material as THREE.Material).dispose(); remotePlayers.delete(message.playerId); } return; }
  if (message.type === 'light_update') { setLightLevel(message.level); if (message.level >= 10) litLocally = true; return; }
  if (message.type === 'interaction_result' && message.success) { litLocally = true; setLightLevel(message.lightLevel); prompt.textContent = 'Diya lit · Shared Light Level +10%'; return; }
  if (message.type === 'inventory_update') { inventory = message.items; ui.setInventory(inventory); return; }
  if (message.type === 'quest_update') { quests = message.quests; ui.setQuests(quests); return; }
  if (message.type === 'pickup_result' && message.success) { const pickup = pickups.get(message.targetId); if (pickup) { pickup.collected = true; pickup.mesh.visible = false; } prompt.textContent = `Collected ${message.quantity} ${message.itemId.replace('_', ' ')}`; return; }
  if (message.type === 'flame_shared') { setLightLevel(message.lightLevel); prompt.textContent = message.fromPlayerId === currentPlayerId ? 'You shared your flame · +5% Light' : 'A nearby player shared their flame · +5% Light'; return; }
  if (message.type === 'world_state') { setLightLevel(message.lightLevel); darkDistrictUnlocked = message.unlockedDistricts.includes('dark-district'); darkGate.material = new THREE.MeshStandardMaterial({ color: darkDistrictUnlocked ? 0x7b4c1d : 0x17130f, emissive: darkDistrictUnlocked ? 0x5a2e0b : 0x24160a, emissiveIntensity: darkDistrictUnlocked ? 1.2 : 0.5 }); if (darkDistrictUnlocked) prompt.textContent = 'The Dark District is awake. The final path has opened.'; return; }
  if (message.type === 'error') prompt.textContent = message.message;
}
function connect() {
  const configured = import.meta.env.VITE_GAME_SERVER_URL as string | undefined; const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'; socket = new WebSocket(configured || `${protocol}//${location.hostname}:8787`);
  const connection = document.getElementById('connection')!; connection.textContent = 'CONNECTING';
  socket.addEventListener('open', () => { connection.textContent = 'ONLINE'; prompt.textContent = 'Welcome. Explore the street and talk to your neighbours.'; send({ type: 'hello', clientVersion: '0.3.0' }); send({ type: 'join_room', roomId: 'main-street' }); });
  socket.addEventListener('message', (event) => { const message = decodeMessage(String(event.data)); if (message && 'type' in message) handleServerMessage(message as ServerMessage); });
  socket.addEventListener('close', () => { connection.textContent = 'OFFLINE'; prompt.textContent = 'Server disconnected. Retrying...'; if (reconnectTimer === undefined) reconnectTimer = window.setTimeout(() => { reconnectTimer = undefined; connect(); }, 1500); });
}
function playerTransform(): PlayerTransform { return { x: player.position.x, y: player.position.y, z: player.position.z, rotation: player.rotation.y }; }
function interact() {
  const nearDiya = isNear(player.position, diya.position, 1.5); if (nearDiya && !litLocally) { send({ type: 'interact_request', targetId: 'diya-main-street-01' }); return; }
  const nearbyPickup = [...pickups.values()].find((entry) => !entry.collected && isNear(player.position, entry.mesh.position, 1.5)); if (nearbyPickup) { send({ type: 'pickup_request', targetId: nearbyPickup.definition.id }); return; }
  const nearbyRemote = [...remotePlayers.entries()].find(([, remote]) => isNear(player.position, remote.mesh.position, 2.5)); if (nearbyRemote) { send({ type: 'share_flame_request', targetPlayerId: nearbyRemote[0] }); return; }
  const nearest = npcGroups.find((entry) => isNear(player.position, entry.group.position, 1.5)); if (nearest) { const line = nearest.npc.dialogue[nearest.index]; ui.showDialogue(line.speaker, line.text); nearest.index = (nearest.index + 1) % nearest.npc.dialogue.length; }
}
addEventListener('keydown', (event) => { if (event.key.toLowerCase() !== 'e' || event.repeat) return; if (!ui.dialogue.hidden) { ui.hideDialogue(); return; } interact(); });
function update(now: number) {
  const direction = new THREE.Vector3((keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), 0, (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0));
  if (direction.lengthSq() > 0) { direction.normalize(); player.position.addScaledVector(direction, 0.11); player.rotation.y = Math.atan2(direction.x, direction.z); player.position.x = THREE.MathUtils.clamp(player.position.x, -3.2, 3.2); player.position.z = THREE.MathUtils.clamp(player.position.z, -19, darkDistrictUnlocked ? 19 : -0.01); }
  const near = isNear(player.position, diya.position, 1.5); const pickup = [...pickups.values()].find((entry) => !entry.collected && isNear(player.position, entry.mesh.position, 1.5)); const remote = [...remotePlayers.values()].find((entry) => isNear(player.position, entry.mesh.position, 2.5)); const nearNpc = npcGroups.find((entry) => isNear(player.position, entry.group.position, 1.5));
  if (ui.dialogue.hidden) prompt.textContent = near && !litLocally ? 'Press E to light the diya' : pickup ? `Press E to collect ${pickup.definition.label}` : remote ? 'Press E to share your flame' : nearNpc ? `Press E to talk to ${nearNpc.npc.name}` : darkDistrictUnlocked ? 'The Dark District is open' : `Shared Light Level ${lightLevel}%`;
  if (now - lastNetworkSend > 100) { send({ type: 'player_state', transform: playerTransform() }); lastNetworkSend = now; }
  for (const remoteEntry of remotePlayers.values()) { remoteEntry.mesh.position.lerp(remoteEntry.target, 0.18); remoteEntry.mesh.rotation.y = THREE.MathUtils.lerp(remoteEntry.mesh.rotation.y, remoteEntry.rotation, 0.18); }
  camera.position.lerp(new THREE.Vector3(player.position.x + 6, 6.5, player.position.z + 8), 0.06); camera.lookAt(player.position.x, 1, player.position.z); renderer.render(scene, camera); requestAnimationFrame(update);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
ui.setInventory(inventory); ui.setQuests(quests); connect(); requestAnimationFrame(update);
