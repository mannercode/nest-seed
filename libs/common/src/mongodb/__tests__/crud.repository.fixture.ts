import {
    type Document,
    type Filter,
    type IndexDescription,
    MongoClient,
    type UpdateFilter
} from 'mongodb'
import type { TransactionContext } from '../../index.js'
import {
    CrudDocument,
    CrudRepository,
    MongoConnection,
    objectId,
    type CrudRepositoryOptions,
    type VersionedDocument
} from '../index.js'

export class Sample extends CrudDocument {
    name: string
    secret?: string
}

type SampleDraft = VersionedDocument<Sample>

export class SamplesRepository extends CrudRepository<Sample> {
    constructor(client: MongoClient, collectionName: string, options: CrudRepositoryOptions = {}) {
        super(
            new MongoConnection(
                client,
                client.db(requiredEnvironment('TESTLIB_MONGO_DATABASE')),
                false
            ),
            collectionName,
            3,
            5,
            options
        )
    }

    async create(
        name: string,
        options: { transaction?: TransactionContext; signal?: AbortSignal } = {}
    ) {
        const doc = this.draft(name)
        return this.insertOne(doc, options.transaction, options.signal)
    }

    async createMany(
        names: string[],
        options: { transaction?: TransactionContext; signal?: AbortSignal } = {}
    ) {
        const docs = names.map((name) => this.draft(name))
        await this.insertMany(docs, options.transaction, options.signal)
        return docs
    }

    draft(name: string): SampleDraft {
        return Object.assign(this.newDocument(), { name })
    }

    async insertDrafts(
        docs: SampleDraft[],
        transaction?: TransactionContext,
        signal?: AbortSignal
    ) {
        await this.insertMany(docs, transaction, signal)
    }

    async rename(id: string, name: string, transaction: TransactionContext) {
        await this.collection.updateOne(
            { _id: objectId(id) },
            { $set: { name } },
            { session: this.getSession(transaction) }
        )
    }

    override idFilter(id: string) {
        return super.idFilter(id)
    }

    override idsFilter(ids: string[]) {
        return super.idsFilter(ids)
    }

    toActiveFilter(filter: Filter<Document>) {
        return this.activeFilter(filter)
    }

    toTimestamped(update: UpdateFilter<Document>) {
        return this.timestamped(update)
    }
}

export type MongoRepositoryFixture = {
    client: MongoClient
    hard: SamplesRepository
    projected: SamplesRepository
    soft: SamplesRepository
    teardown: () => Promise<void>
}

export async function createMongoRepositoryFixture(): Promise<MongoRepositoryFixture> {
    const client = new MongoClient(requiredEnvironment('TESTLIB_MONGO_URI'))
    try {
        await client.connect()

        const customIndexes: IndexDescription[] = [{ key: { name: 1 }, name: 'name_lookup' }]
        const soft = new SamplesRepository(client, 'nativeCrudSoftSamples', {
            indexes: customIndexes
        })
        const hard = new SamplesRepository(client, 'nativeCrudHardSamples', { hardDelete: true })
        const projected = new SamplesRepository(client, 'nativeCrudProjectedSamples', {
            projection: { secret: 0 }
        })

        await soft.onModuleInit()
        await hard.onModuleInit()
        await projected.onModuleInit()

        return { client, hard, projected, soft, teardown: () => client.close() }
    } catch (error) {
        // 정리 실패가 원래 연결·초기화 오류를 덮지 않게 한다.
        await client.close().catch(() => undefined)
        throw error
    }
}

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}
