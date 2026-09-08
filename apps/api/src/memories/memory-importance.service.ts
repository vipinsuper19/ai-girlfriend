import { Injectable } from '@nestjs/common';

export type MemoryImportanceLevel =
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

export interface ImportanceResult {
    score: number;
    level: MemoryImportanceLevel;
    shouldStore: boolean;
}

@Injectable()
export class MemoryImportanceService {
    private readonly minimumStoreScore = 4;

    score(
        importance: unknown,
    ): ImportanceResult {
        let score = this.normalizeScore(
            importance,
        );

        return {
            score,
            level: this.getLevel(score),
            shouldStore:
                score >= this.minimumStoreScore,
        };

    }

    private normalizeScore(
        importance: unknown,
    ): number {
        if (
            typeof importance !== 'number' ||
            !Number.isFinite(importance)
        ) {
            return 0;
        }

        return Math.max(
            1,
            Math.min(
                10,
                Math.round(importance),
            ),
        );

    }

    private getLevel(
        score: number,
    ): MemoryImportanceLevel {
        if (score <= 3) {
            return 'LOW';
        }

        if (score <= 6) {
            return 'MEDIUM';
        }

        if (score <= 8) {
            return 'HIGH';
        }

        return 'CRITICAL';

    }
}