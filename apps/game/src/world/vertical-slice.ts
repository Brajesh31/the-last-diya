import * as THREE from 'three';

export type VerticalSliceNpcId =
  | 'sharma-aunty'
  | 'mithai-seller'
  | 'chai-seller'
  | 'temple-caretaker'
  | 'grandmother';

export interface VerticalSliceNpcDefinition {
  id: VerticalSliceNpcId;
  name: string;
  role: string;
  position: [number, number, number];
  dialogue: string[];
}

export const VERTICAL_SLICE_NPCS: VerticalSliceNpcDefinition[] = [
  {
    id: 'sharma-aunty',
    name: 'Sharma Aunty',
    role: 'Neighbour',
    position: [-7, 0, -5],
    dialogue: ['The lane used to glow every Diwali.', 'If you light one diya, perhaps someone else will remember the next.'],
  },
  {
    id: 'mithai-seller',
    name: 'Mohan',
    role: 'Mithai seller',
    position: [7, 0, -4],
    dialogue: ['The market feels strangely quiet this year.', 'Help me light the stalls and I will share the sweets.'],
  },
  {
    id: 'chai-seller',
    name: 'Rekha',
    role: 'Chai seller',
    position: [8, 0, 5],
    dialogue: ['Sit for a moment. Festivals are not meant to be rushed.', 'There is an old story behind the temple bell.'],
  },
  {
    id: 'temple-caretaker',
    name: 'Hari',
    role: 'Temple caretaker',
    position: [0, 0, 12],
    dialogue: ['The temple courtyard remembers every family that came here.', 'The last memory is waiting beyond the old gate.'],
  },
  {
    id: 'grandmother',
    name: 'Dadi',
    role: 'Story keeper',
    position: [-9, 0, 8],
    dialogue: ['When I was young, every doorstep carried a little light.', 'Perhaps the city did not forget Diwali. We simply stopped telling its stories.'],
  },
];

function npcMaterial(role: string) {
  const colors: Record<string, number> = {
    Neighbour: 0xb96d45,
    'Mithai seller': 0xd39b55,
    'Chai seller': 0x7b5139,
    'Temple caretaker': 0x8f6b3f,
    'Story keeper': 0x806b58,
  };
  return new THREE.MeshStandardMaterial({ color: colors[role] ?? 0x777777 });
}

export function createVerticalSliceNpc(definition: VerticalSliceNpcDefinition): THREE.Group {
  const group = new THREE.Group();
  group.name = `npc-${definition.id}`;
  group.position.set(...definition.position);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38, 0.85, 4, 8),
    npcMaterial(definition.role),
  );
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xc98b68 }),
  );
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);

  return group;
}

export function createVerticalSliceNpcs(): THREE.Group {
  const npcs = new THREE.Group();
  npcs.name = 'vertical-slice-npcs';
  for (const definition of VERTICAL_SLICE_NPCS) {
    npcs.add(createVerticalSliceNpc(definition));
  }
  return npcs;
}
