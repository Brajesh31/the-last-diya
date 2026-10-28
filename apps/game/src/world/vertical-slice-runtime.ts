import * as THREE from 'three';
import { FINAL_EVENT_STEPS, FIRST_MEMORY_SEQUENCE } from './vertical-slice-content';

export interface VerticalSliceRuntime {
  setLightLevel(level: number): void;
  playMemory(): void;
  playFinalEvent(): void;
  dispose(): void;
}

export function createVerticalSliceRuntime(scene: THREE.Scene): VerticalSliceRuntime {
  const celebration = new THREE.Group();
  celebration.name = 'vertical-slice-celebration';
  celebration.visible = false;
  scene.add(celebration);

  const streetLights: THREE.PointLight[] = [];
  for (const [x, z] of [[-3.2, -12], [3.2, -12], [-3.2, -6], [3.2, -6], [-3.2, 0], [3.2, 0]]) {
    const light = new THREE.PointLight(0xffb84d, 0, 7);
    light.position.set(x, 2.2, z);
    celebration.add(light);
    streetLights.push(light);
  }

  const communityDiya = new THREE.Group();
  communityDiya.position.set(0, 0.35, -16.5);
  const bowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x8b5a35, roughness: 0.8 }),
  );
  bowl.scale.y = 0.35;
  communityDiya.add(bowl);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xffc857 }),
  );
  flame.scale.set(0.7, 1.9, 0.7);
  flame.position.y = 0.25;
  flame.visible = false;
  communityDiya.add(flame);
  celebration.add(communityDiya);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(8,6,4,.86);z-index:20;color:#f6eee0;font-family:system-ui;text-align:center;padding:32px;';
  document.body.appendChild(overlay);

  const showMemory = () => {
    let index = 0;
    overlay.style.display = 'flex';
    const renderLine = () => {
      overlay.innerHTML = `<div style="max-width:620px"><div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#d8a65b;margin-bottom:18px">A MEMORY OF THE LANE</div><div style="font-size:28px;line-height:1.4">${FIRST_MEMORY_SEQUENCE[index]}</div><div style="margin-top:24px;font-size:12px;color:#aaa">Press E to continue</div></div>`;
    };
    renderLine();
    const advance = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'e') return;
      index += 1;
      if (index >= FIRST_MEMORY_SEQUENCE.length) {
        overlay.style.display = 'none';
        removeEventListener('keydown', advance);
        return;
      }
      renderLine();
    };
    addEventListener('keydown', advance);
  };

  let finalTimer: number | undefined;
  const playFinalEvent = () => {
    if (finalTimer !== undefined) return;
    celebration.visible = true;
    flame.visible = true;
    overlay.style.display = 'flex';
    let step = 0;
    overlay.innerHTML = `<div style="max-width:700px"><div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#d8a65b;margin-bottom:18px">THE LAST DIYA</div><div id="final-step" style="font-size:30px;line-height:1.35">${FINAL_EVENT_STEPS[0]}</div></div>`;
    finalTimer = window.setInterval(() => {
      step += 1;
      streetLights.forEach((light, index) => { light.intensity = index <= step ? 2.4 : 0; });
      const element = document.getElementById('final-step');
      if (element) element.textContent = FINAL_EVENT_STEPS[Math.min(step, FINAL_EVENT_STEPS.length - 1)];
      if (step >= FINAL_EVENT_STEPS.length) {
        window.clearInterval(finalTimer);
        finalTimer = undefined;
        window.setTimeout(() => { overlay.style.display = 'none'; }, 1800);
      }
    }, 1300);
  };

  return {
    setLightLevel(level) {
      const normalized = Math.max(0, Math.min(100, level)) / 100;
      streetLights.forEach((light) => { light.intensity = normalized * 1.2; });
      communityDiya.visible = level >= 90;
    },
    playMemory: showMemory,
    playFinalEvent,
    dispose() {
      if (finalTimer !== undefined) window.clearInterval(finalTimer);
      overlay.remove();
      scene.remove(celebration);
    },
  };
}
