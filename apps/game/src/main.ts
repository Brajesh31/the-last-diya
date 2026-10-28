import * as THREE from 'three';
import { LIGHT_LEVEL_START } from '@the-last-diya/shared';
import { clampLightLevel, isNear } from '@the-last-diya/game-core';

const root = document.getElementById('game')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080a0a);
scene.fog = new THREE.Fog(0x080a0a, 18, 55);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.set(7, 7, 9);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
root.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x91a0b2, 0x17120c, 0.45);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xaabbd2, 1.0);
moon.position.set(-8, 12, 6); moon.castShadow = true; scene.add(moon);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), new THREE.MeshStandardMaterial({ color: 0x20211f, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 42), new THREE.MeshStandardMaterial({ color: 0x343432, roughness: 1 }));
road.rotation.x = -Math.PI / 2; road.position.y = 0.01; scene.add(road);

for (let i = -18; i <= 18; i += 6) {
  for (const x of [-6, 6]) {
    const house = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 4.5), new THREE.MeshStandardMaterial({ color: 0x4a4037 }));
    house.position.set(x, 1.6, i); house.castShadow = true; scene.add(house);
  }
}

const diya = new THREE.Group();
const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8b5a35, roughness: 0.8 }));
bowl.scale.y = 0.35; diya.add(bowl);
const flame = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffc857 }));
flame.scale.set(0.7, 1.8, 0.7); flame.position.y = 0.22; diya.add(flame);
diya.position.set(0, 0.3, -4); scene.add(diya);
const diyaLight = new THREE.PointLight(0xffb84d, 1.8, 8); diyaLight.position.copy(diya.position).add(new THREE.Vector3(0, 1, 0)); scene.add(diyaLight);

const player = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.8, 4, 12), new THREE.MeshStandardMaterial({ color: 0xbcc7c0 }));
player.position.set(0, 0.75, 4); player.castShadow = true; scene.add(player);

const hud = document.createElement('div');
hud.innerHTML = `<div class="hud"><strong>THE LAST DIYA</strong><span id="light">LIGHT 0%</span><small>WASD / Arrow keys · Move &nbsp; E · Light diya</small></div>`;
document.body.appendChild(hud);
const style = document.createElement('style'); style.textContent = `body{margin:0;overflow:hidden;background:#080a0a;font-family:system-ui;color:#f4f0e8}.hud{position:fixed;top:22px;left:22px;display:grid;gap:7px;padding:14px 16px;background:#0c0d0dcc;border:1px solid #30312e;border-radius:10px}.hud span{font-size:13px;color:#f1b85b}.hud small{color:#9c9e99}.prompt{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);padding:12px 16px;background:#0c0d0de8;border:1px solid #30312e;border-radius:8px}`; document.head.appendChild(style);

const keys = new Set<string>(); addEventListener('keydown', e => keys.add(e.key.toLowerCase())); addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
let lightLevel = LIGHT_LEVEL_START; let lit = false;
const prompt = document.createElement('div'); prompt.className = 'prompt'; prompt.textContent = 'Walk to the diya'; document.body.appendChild(prompt);

function update() {
  const direction = new THREE.Vector3((keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), 0, (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0));
  if (direction.lengthSq() > 0) { direction.normalize(); player.position.addScaledVector(direction, 0.11); player.position.x = THREE.MathUtils.clamp(player.position.x, -3.2, 3.2); player.position.z = THREE.MathUtils.clamp(player.position.z, -19, 19); }
  const near = isNear(player.position, diya.position, 1.5);
  prompt.textContent = near && !lit ? 'Press E to light the diya' : lit ? 'The first light is awake.' : 'Walk to the diya';
  if (near && keys.has('e') && !lit) { lit = true; lightLevel = clampLightLevel(lightLevel + 10); keys.delete('e'); diyaLight.intensity = 3.2; hemi.intensity = 0.65; scene.background.set(0x15110b); scene.fog = new THREE.Fog(0x15110b, 20, 60); prompt.textContent = 'Diya lit · Light Level +10%'; }
  camera.position.lerp(new THREE.Vector3(player.position.x + 6, 6.5, player.position.z + 8), 0.06); camera.lookAt(player.position.x, 1, player.position.z);
  (document.getElementById('light')!).textContent = `LIGHT ${lightLevel}%`;
  renderer.render(scene, camera); requestAnimationFrame(update);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
update();
