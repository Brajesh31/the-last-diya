import * as THREE from 'three';

export interface MemorySequence {
  open(): void;
  close(): void;
  update(deltaSeconds: number): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createMemorySequence(): MemorySequence {
  const overlay = document.createElement('div');
  overlay.hidden = true;
  overlay.innerHTML = '<div class="memory-card"><span>MEMORY</span><h2>The light was never ours alone.</h2><p>Doorways glowed. Children carried sweets. Neighbours greeted one another. One flame became another.</p><small>Press E to continue</small></div>';
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', display: 'grid', placeItems: 'center',
    background: 'rgba(5, 5, 4, 0.82)', zIndex: '50', color: '#f4f0e8',
    fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '24px',
  });
  document.body.appendChild(overlay);

  let open = false;
  let elapsed = 0;
  return {
    open() { open = true; elapsed = 0; overlay.hidden = false; },
    close() { open = false; overlay.hidden = true; },
    update(deltaSeconds) {
      if (!open) return;
      elapsed += deltaSeconds;
      overlay.style.opacity = String(Math.min(1, elapsed * 2));
    },
    isOpen() { return open; },
    dispose() { overlay.remove(); },
  };
}

export function createMemoryMarker(scene: THREE.Scene, position: THREE.Vector3): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3),
    new THREE.MeshStandardMaterial({ color: 0xc98b4b, emissive: 0x6b3e0c, emissiveIntensity: 1 }),
  );
  marker.position.copy(position);
  scene.add(marker);
  return marker;
}
