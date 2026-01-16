import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { AssetsClient } from 'apps/infrastructures'
import { DateUtil } from 'common'
import { Rules } from 'shared'
import { MovieAssetsOutboxRepository } from './movie-assets-outbox.repository'
import { MovieAssetsOutbox } from './models'
import type { ClientSession } from 'mongoose'

const OUTBOX_BATCH_SIZE = 20
const OUTBOX_LOCK_SECONDS = 30
const OUTBOX_BASE_BACKOFF_SECONDS = 60
const OUTBOX_MAX_BACKOFF_SECONDS = 60 * 30

@Injectable()
export class MovieAssetsOutboxService {
    constructor(
        private readonly repository: MovieAssetsOutboxRepository,
        private readonly assetsClient: AssetsClient
    ) {}

    enqueueDelete(assetIds: string[], movieIds: string[], session: ClientSession) {
        return this.repository.enqueueDelete(assetIds, movieIds, session)
    }

    async dispatchNow(outboxId: string) {
        try {
            await this.dispatchById(outboxId)
        } catch {
            return
        }
    }

    @Cron(Rules.Movie.assetDeleteOutboxCron, { name: 'movies.assetsOutboxDispatch' })
    async dispatchPending() {
        const now = DateUtil.now()
        const outboxes: MovieAssetsOutbox[] = []

        for (let i = 0; i < OUTBOX_BATCH_SIZE; i++) {
            const outbox = await this.repository.claimNext(now, OUTBOX_LOCK_SECONDS)
            if (!outbox) break
            outboxes.push(outbox)
        }

        for (const outbox of outboxes) {
            await this.dispatch(outbox)
        }
    }

    private async dispatchById(outboxId: string) {
        const now = DateUtil.now()
        const outbox = await this.repository.claimById(outboxId, now, OUTBOX_LOCK_SECONDS)
        if (!outbox) return
        await this.dispatch(outbox)
    }

    private async dispatch(outbox: MovieAssetsOutbox) {
        try {
            await this.assetsClient.deleteMany(outbox.assetIds)
            await this.repository.markSent(outbox.id)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const nextAttemptAt = this.calculateNextAttemptAt(outbox.attempts)
            await this.repository.markFailed(outbox.id, message, nextAttemptAt)
        }
    }

    private calculateNextAttemptAt(attempts: number) {
        const backoffSeconds = Math.min(
            OUTBOX_BASE_BACKOFF_SECONDS * Math.max(attempts, 1),
            OUTBOX_MAX_BACKOFF_SECONDS
        )

        return DateUtil.add({ seconds: backoffSeconds })
    }
}
