# The Last Diya · Vertical Slice

The first playable story slice turns the technical prototype into a small, coherent Diwali neighbourhood adventure.

## Player journey

1. Spawn on Main Street.
2. Meet Sharma Aunty and light the first diya.
3. Help Mohan restore the market stalls.
4. Visit Rekha's chai stall and recover a memory fragment.
5. Bring the memory to Hari at the temple courtyard.
6. Meet Dadi and learn why the neighbourhood stopped celebrating together.
7. Reach the Dark District after the shared Light Level reaches 90%.
8. Light the community diya.
9. Trigger the final neighbourhood celebration.

## Five NPCs

- Sharma Aunty: introduces the first flame and the neighbourhood mystery.
- Mohan: gives the market restoration quest.
- Rekha: introduces the first memory sequence.
- Hari: connects the memory to the temple courtyard.
- Dadi: delivers the emotional story and final objective.

## Five quests

| Quest | Core action | Progression |
| --- | --- | --- |
| The First Flame | Light Main Street diya | Opens the story |
| A Market Wakes | Restore three stalls | Activates market |
| Chai, Rain and Memory | Recover memory fragment | Reveals history |
| The Bell Remembers | Return memory to temple | Points toward Dark District |
| The Last Diya | Light community diya | Starts finale |

## Memory sequence

The first memory should be short, visual and interruption-free. The player sees the same street in the past: doorways glowing, children carrying sweets, families greeting neighbours, and a shared flame moving from home to home.

The message is about community, not a supernatural power system: nobody owned the light; people passed it on.

## Final event

At 100% Light Level, the community diya becomes interactive. Once activated, the server broadcasts a single final-event state to every player in the room. The client then transitions the environment through the celebration steps:

1. Community diya ignites.
2. Dark District lights street by street.
3. Market, homes and temple courtyard glow together.
4. Every player receives the final memory.
5. Celebration ambience begins.

## Vertical-slice acceptance criteria

- Five NPCs are present and interactable.
- Five quests form one connected journey.
- The first memory can be triggered and completed.
- Market and temple areas communicate story through NPC dialogue and environmental lights.
- Dark District remains inaccessible before 90% Light Level.
- Final community diya remains unavailable until the final quest state is reached.
- Final event is authoritative and synchronized for every player in the room.
- No combat is required for the vertical slice.
