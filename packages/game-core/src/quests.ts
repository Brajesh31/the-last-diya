export type QuestId = 'first-flame' | 'help-sharma-aunty' | 'market-lights' | 'temple-memory' | 'last-diya';

export type QuestStatus = 'locked' | 'available' | 'active' | 'completed';

export interface QuestDefinition {
  id: QuestId;
  title: string;
  description: string;
  requires?: QuestId[];
  reward?: { itemId: string; quantity: number };
}

export interface QuestState {
  id: QuestId;
  status: QuestStatus;
  progress: number;
  target: number;
}

export const QUESTS: QuestDefinition[] = [
  { id: 'first-flame', title: 'The First Flame', description: 'Light the diya waiting at the end of the street.' },
  { id: 'help-sharma-aunty', title: 'A Little Help', description: 'Help Sharma Aunty prepare her doorway.', requires: ['first-flame'], reward: { itemId: 'wick', quantity: 2 } },
  { id: 'market-lights', title: 'Lights of the Market', description: 'Help bring three stalls back to life.', requires: ['help-sharma-aunty'], reward: { itemId: 'diya', quantity: 3 } },
  { id: 'temple-memory', title: 'A Forgotten Memory', description: 'Discover the memory hidden near the old temple.', requires: ['market-lights'], reward: { itemId: 'memory_fragment', quantity: 1 } },
  { id: 'last-diya', title: 'The Last Diya', description: 'Carry the final flame to the dark district.', requires: ['temple-memory'] },
];

export function initialQuestStates(): QuestState[] {
  return QUESTS.map((quest, index) => ({
    id: quest.id,
    status: index === 0 ? 'available' : 'locked',
    progress: 0,
    target: quest.id === 'market-lights' ? 3 : 1,
  }));
}

export function getQuestDefinition(id: QuestId): QuestDefinition | undefined {
  return QUESTS.find((quest) => quest.id === id);
}

export function canProgressQuest(states: QuestState[], id: QuestId): boolean {
  const state = states.find((quest) => quest.id === id);
  return state?.status === 'available' || state?.status === 'active';
}

export function completeQuest(states: QuestState[], id: QuestId): QuestState[] {
  return states.map((state) => state.id === id ? { ...state, status: 'completed', progress: state.target } : state);
}
