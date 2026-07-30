import { describe, expect, it } from 'vitest';
import {
    isQuestAvailableForFocus,
    isQuestPendingForFocus,
    markQuestDiscarded
} from './gameState.js';

describe('quest focus state', () => {
    it('keeps active focused quests in the Today queue', () => {
        const quest = {
            id: 'quest-1',
            completed: false,
            discarded: false,
            isFocusedToday: true
        };

        expect(isQuestAvailableForFocus(quest)).toBe(true);
        expect(isQuestPendingForFocus(quest)).toBe(true);
    });

    it('removes a quest from Today when it is discarded', () => {
        const discardedAt = '2026-07-30T12:00:00.000Z';
        const quest = {
            id: 'quest-1',
            completed: false,
            discarded: false,
            isFocusedToday: true
        };

        const discardedQuest = markQuestDiscarded(quest, discardedAt);

        expect(discardedQuest).toMatchObject({
            discarded: true,
            discardedAt,
            isFocusedToday: false
        });
        expect(isQuestAvailableForFocus(discardedQuest)).toBe(false);
        expect(isQuestPendingForFocus(discardedQuest)).toBe(false);
    });

    it('rejects stale discarded records even if they still claim Today membership', () => {
        const staleDiscardedQuest = {
            id: 'legacy-quest',
            completed: false,
            discarded: true,
            isFocusedToday: true
        };

        expect(isQuestAvailableForFocus(staleDiscardedQuest)).toBe(false);
        expect(isQuestPendingForFocus(staleDiscardedQuest)).toBe(false);
    });
});
