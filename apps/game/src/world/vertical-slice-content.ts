export interface VerticalSliceQuest {
  id: string;
  title: string;
  giver: string;
  objective: string;
  reward: string;
}

export const VERTICAL_SLICE_QUESTS: VerticalSliceQuest[] = [
  {
    id: 'first-flame',
    title: 'The First Flame',
    giver: 'Sharma Aunty',
    objective: 'Light the forgotten diya on Main Street.',
    reward: 'The neighbourhood remembers its first spark.',
  },
  {
    id: 'market-lights',
    title: 'A Market Wakes',
    giver: 'Mohan',
    objective: 'Collect wicks and relight three market stalls.',
    reward: 'The market opens and sweets return to the street.',
  },
  {
    id: 'chai-and-memory',
    title: 'Chai, Rain and Memory',
    giver: 'Rekha',
    objective: 'Visit the chai stall and recover the old festival memory.',
    reward: 'A memory fragment reveals the temple bell story.',
  },
  {
    id: 'temple-memory',
    title: 'The Bell Remembers',
    giver: 'Hari',
    objective: 'Bring the recovered memory to the temple courtyard.',
    reward: 'The path toward the dark district opens.',
  },
  {
    id: 'last-diya',
    title: 'The Last Diya',
    giver: 'Dadi',
    objective: 'Carry the final flame into the dark district and light the community diya.',
    reward: 'The neighbourhood celebrates together.',
  },
];

export const FIRST_MEMORY_SEQUENCE = [
  'The street was brighter once.',
  'Families left little lamps outside every doorway.',
  'Children carried sweets from one home to another.',
  'Nobody asked who owned the light. They simply passed it on.',
];

export const FINAL_EVENT_STEPS = [
  'The final community diya ignites.',
  'The dark district lights up street by street.',
  'The market, homes and temple courtyard glow together.',
  'Every player receives the same final memory.',
  'The neighbourhood celebrates as one.',
];
