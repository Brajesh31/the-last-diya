import * as THREE from 'three';
import { clampLightLevel, isNear } from '@the-last-diya/game-core';
import { decodeMessage, encodeMessage } from '@the-last-diya/networking';
import { LIGHT_LEVEL_START } from '@the-last-diya/shared';
import type { PlayerTransform, ServerMessage } from '@the-last-diya/shared';

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
const moon = new THREE.DirectionalLight(0xaabbd2, 1.0);
moon.position.set(-8, 12, 6);
moon.castShadow = true;
scene.add(moon);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(42, 42),
  new THREE.MeshStandardMaterial({ color: 0x20211f, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const road = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 42),
  new THREE.MeshStandardMaterial({ color: 0x343432, roughness: 1 }),
);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
scene.add(road);

for (let i = -18; i <= 18; i += 6) {
  for (const x of [-6, 6]) {
    const house = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 3.2, 4.5),
      new THREE.MeshStandardMaterial({ color: 0x4a4037 }),
    );
    house.position.set(x, 1.6, i);
    house.castShadow = true;
    scene.add(house);
  }
}

const diya = new THREE.Group();
const bowl = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x8b5a35, roughness: 0.8 }),
);
bowl.scale.y = 0.35;
diya.add(bowl);
const flame = new THREE.Mesh(
  new THREE.SphereGeometry(0.18, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffc857 }),
);
flame.scale.set(0.7, 1.8, 0.7);
flame.position.y = 0.22;
diya.add(flame);
diya.position.set(0, 0.3, -4);
scene.add(diya);

const diyaLight = new THREE.PointLight(0xffb84d, 1.8, 8);
diyaLight.position.copy(diya.position).add(new THREE.Vector3(0, 1, 0));
scene.add(diyaLight);

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.38, 0.8, 4, 12),
  new THREE.MeshStandardMaterial({ color: 0xbcc7c0 }),
);
player.position.set(0, 0.75, 4);
player.castShadow = true;
scene.add(player);

const remotePlayers = new Map<string, { mesh: THREE.Mesh; target: THREE.Vector3; rotation: number }>();
const makeRemotePlayer = () => {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.72, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x8f9b96 }),
  );
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
};

const hud = document.createElement('div');
hud.innerHTML = `<div class="hud"><strong>THE LAST DIYA</strong><span id="connection">CONNECTING</span><span id="light">LIGHT ${LIGHT_LEVEL_START}%</span><small>WASD / Arrow keys · Move &nbsp; E · Light diya</small></div>`;
document.body.appendChild(hud);
const style = document.createElement('style');
style.textContent = `body{margin:0;overflow:hidden;background:#080a0a;font-family:system-ui;color:#f4f0e8}.hud{position:fixed;top:22px;left:22px;display:grid;gap:7px;padding:14px 16px;background:#0c0d0dcc;border:1px solid #30312e;border-radius:10px;min-width:190px}.hud span{font-size:13px;color:#f1b85b}.hud small{color:#9c9e99}.prompt{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);padding:12px 16px;background:#0c0d0de8;border:1px solid #30312e;border-radius:8px}`;
document.head.appendChild(style);

const prompt = document.createElement('div');
prompt.className = 'prompt';
prompt.textContent = 'Connecting to the neighbourhood...';
document.body.appendChild(prompt);

const keys = new Set<string>();
addEventListener('keydown', (event) => keys.add(event.key.toLowerCase()));
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

let lightLevel = LIGHT_LEVEL_START;
let litLocally = false;
let socket: WebSocket | null = null;
let lastNetworkSend = 0;
let reconnectTimer: number | undefined;

function setLightLevel(value: number) {
  lightLevel = clampLightLevel(value);
  document.getElementById('light')!.textContent = `LIGHT ${lightLevel}%`;
  hemi.intensity = 0.45 + lightLevel / 300;
  if (lightLevel > 0) {
    scene.background.set(0x15110b);
    scene.fog = new THREE.Fog(0x15110b, 20, 60);
    diyaLight.intensity = 1.8 + lightLevel / 20;
  }
}

function send(message: Parameters<typeof encodeMessage>[0]) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(encodeMessage(message));
}

function handleServerMessage(message: ServerMessage) {
  if (message.type === 'player_spawned') {
    const existing = remotePlayers.get(message.playerId);
    if (existing) return;
    const mesh = makeRemotePlayer();
    mesh.position.set(message.transform.x, message.transform.y, message.transform.z);
    remotePlayers.set(message.playerId, {
      mesh,
      target: new THREE.Vector3(message.transform.x, message.transform.y, message.transform.z),
      rotation: message.transform.rotation,
    });
    return;
  }

  if (message.type === 'player_state') {
    const remote = remotePlayers.get(message.playerId);
    if (!remote) return;
    remote.target.set(message.transform.x, message.transform.y, message.transform.z);
    remote.rotation = message.transform.rotation;
    return;
  }

  if (message.type === 'player_left') {
    const remote = remotePlayers.get(message.playerId);
    if (!remote) return;
    scene.remove(remote.mesh);
    remote.mesh.geometry.dispose();
    (remote.mesh.material as THREE.Material).dispose();
    remotePlayers.delete(message.playerId);
    return;
  }

  if (message.type === 'light_update') {
    setLightLevel(message.level);
    if (message.level >= 10) litLocally = true;
    prompt.textContent = `Shared Light Level ${message.level}%`;
    return;
  }

  if (message.type === 'interaction_result' && message.success) {
    litLocally = true;
    setLightLevel(message.lightLevel);
    prompt.textContent = 'Diya lit · Shared Light Level +10%';
    return;
  }

  if (message.type === 'error') prompt.textContent = message.message;
}

function connect() {
  const configured = import.meta.env.VITE_GAME_SERVER_URL as string | undefined;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const endpoint = configured || `${protocol}//${location.hostname}:8787`;
  socket = new WebSocket(endpoint);
  const connection = document.getElementById('connection')!;
  connection.textContent = 'CONNECTING';

  socket.addEventListener('open', () => {
    connection.textContent = 'ONLINE';
    prompt.textContent = 'Welcome. Walk to the diya.';
    send({ type: 'hello', clientVersion: '0.1.0' });
    send({ type: 'join_room', roomId: 'main-street' });
  });

  socket.addEventListener('message', (event) => {
    const message = decodeMessage(String(event.data));
    if (message && 'type' in message) handleServerMessage(message as ServerMessage);
  });

  socket.addEventListener('close', () => {
    connection.textContent = 'OFFLINE';
    prompt.textContent = 'Server disconnected. Retrying...';
    if (reconnectTimer === undefined) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        connect();
      }, 1500);
    }
  });
}

function playerTransform(): PlayerTransform {
  return {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    rotation: player.rotation.y,
  };
}

function update(now: number) {
  const direction = new THREE.Vector3(
    (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0),
    0,
    (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0),
  );

  if (direction.lengthSq() > 0) {
    direction.normalize();
    player.position.addScaledVector(direction, 0.11);
    player.rotation.y = Math.atan2(direction.x, direction.z);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -3.2, 3.2);
    player.position.z = THREE.MathUtils.clamp(player.position.z, -19, 19);
  }

  const near = isNear(player.position, diya.position, 1.5);
  prompt.textContent = near && !litLocally ? 'Press E to light the diya' : litLocally ? `Shared Light Level ${lightLevel}%` : 'Walk to the diya';

  if (near && keys.has('e') && !litLocally) {
    send({ type: 'interact_request', targetId: 'diya-main-street-01' });
    keys.delete('e');
  }

  if (now - lastNetworkSend > 100) {
    send({ type: 'player_state', transform: playerTransform() });
    lastNetworkSend = now;
  }

  for (const remote of remotePlayers.values()) {
    remote.mesh.position.lerp(remote.target, 0.18);
    remote.mesh.rotation.y = THREE.MathUtils.lerp(remote.mesh.rotation.y, remote.rotation, 0.18);
  }

  camera.position.lerp(new THREE.Vector3(player.position.x + 6, 6.5, player.position.z + 8), 0.06);
  camera.lookAt(player.position.x, 1, player.position.z);
  renderer.render(scene, camera);
  requestAnimationFrame(update);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

connect();
requestAnimationFrame(update);
