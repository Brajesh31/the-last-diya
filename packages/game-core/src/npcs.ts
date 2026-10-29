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
      { speaker: 'Sharma Aunty', text: 'I have kept the old wicks safe all these years. I suppose I was waiting for this evening.' },
      { speaker: 'Sharma Aunty', text: 'Look at everyone coming outside. A neighbourhood only feels alive when people choose to be part of it.' },
    ],
  },
  {
    id: 'mithai-seller', name: 'Rafiq', role: 'Mithai seller', position: { x: 2.5, z: -8 },
    dialogue: [
      { speaker: 'Rafiq', text: 'Fresh sweets are ready. We are just missing the lights.' },
      { speaker: 'Rafiq', text: 'The first few diyas make the shop feel like it remembers how to smile.' },
      { speaker: 'Rafiq', text: 'Take a sweet. Festivals are meant to be shared, not counted.' },
      { speaker: 'Rafiq', text: 'You brought the light back. I will make sure nobody celebrates on an empty plate.' },
    ],
  },
  {
    id: 'chai-seller', name: 'Meena', role: 'Chai seller', position: { x: -2.5, z: -12 },
    dialogue: [
      { speaker: 'Meena', text: 'Sit for a minute. Some things are better remembered slowly.' },
      { speaker: 'Meena', text: 'When the lights disappear, people stop looking at one another. Chai helps, but company helps more.' },
      { speaker: 'Meena', text: 'Hear that? Someone is laughing again. I had almost forgotten how this lane sounded.' },
      { speaker: 'Meena', text: 'Stay for one more cup. The night is finally beginning.' },
    ],
  },
  {
    id: 'temple-caretaker', name: 'Kaka', role: 'Caretaker', position: { x: 2.5, z: -17 },
    dialogue: [
      { speaker: 'Kaka', text: 'There is an old memory here. It appears when enough light returns.' },
      { speaker: 'Kaka', text: 'Every generation thinks it is the one keeping the flame alive. The truth is, we keep it alive for one another.' },
      { speaker: 'Kaka', text: 'The old lamp is awake. Some memories do not disappear. They simply wait for us to notice them.' },
      { speaker: 'Kaka', text: 'You did not restore this place alone. You reminded everyone that they could help.' },
    ],
  },
  {
    id: 'unknown-stranger', name: 'The Stranger', role: 'Unknown', position: { x: 0, z: -19 },
    dialogue: [
      { speaker: 'The Stranger', text: 'You are closer than you think.' },
      { speaker: 'The Stranger', text: 'Light is strange. The more you give away, the less afraid you are of losing it.' },
      { speaker: 'The Stranger', text: 'You have reached the place the others were afraid to enter.' },
      { speaker: 'The Stranger', text: 'Now look behind you. The answer was never hidden in the darkness. It was waiting in the people.' },
    ],
  },
];
