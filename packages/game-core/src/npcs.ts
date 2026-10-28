export type NpcId = 'sharma-aunty' | 'mithai-seller' | 'chai-seller' | 'temple-caretaker' | 'unknown-stranger';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface NpcDefinition {
  id: NpcId;
  name: string;
  role: string;
  position: { x: number; z: number };
  dialogue: DialogueLine[];
}

export const NPCS: NpcDefinition[] = [
  {
    id: 'sharma-aunty', name: 'Sharma Aunty', role: 'Neighbour', position: { x: -2.5, z: -1 },
    dialogue: [
      { speaker: 'Sharma Aunty', text: 'The street feels different this year. Too quiet.' },
      { speaker: 'Sharma Aunty', text: 'Maybe it only needs someone to light the first diya.' },
    ],
  },
  {
    id: 'mithai-seller', name: 'Rafiq', role: 'Mithai seller', position: { x: 2.5, z: -8 },
    dialogue: [{ speaker: 'Rafiq', text: 'Fresh sweets are ready. We are just missing the lights.' }],
  },
  {
    id: 'chai-seller', name: 'Meena', role: 'Chai seller', position: { x: -2.5, z: -12 },
    dialogue: [{ speaker: 'Meena', text: 'Sit for a minute. Some things are better remembered slowly.' }],
  },
  {
    id: 'temple-caretaker', name: 'Kaka', role: 'Caretaker', position: { x: 2.5, z: -17 },
    dialogue: [{ speaker: 'Kaka', text: 'There is an old memory here. It appears when enough light returns.' }],
  },
  {
    id: 'unknown-stranger', name: 'The Stranger', role: 'Unknown', position: { x: 0, z: -19 },
    dialogue: [{ speaker: 'The Stranger', text: 'You are closer than you think.' }],
  },
];
