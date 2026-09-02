import {
    type ClientSession,
    type Document,
    type Filter,
    type IndexDescription,
    MongoClient,
    type UpdateFilter
} from 'mongodb'
import {
    CrudDocument,
    CrudRepository,
    type CrudRepositoryOptions,
    type StoredDocument
} from '../index.js'

export class Sample extends CrudDocument {
    name: string
    secret?: string
}

type SampleDraft = Sample & StoredDocument<Sample>

export class SamplesRepository extends CrudRepository<Sample> {
    constructor(client: MongoClient, collectionName: string, options: CrudRepositoryOptions = {}) {
        super(
            client.db(requiredEnvironment('TESTLIB_MONGO_DATABASE')).collection(collectionName),
            client,
            3,
            5,
            options
        )
    }

    async create(name: string, options: { session?: ClientSession; signal?: AbortSignal } = {}) {
        const doc = this.draft(name)
        return this.insertOne(doc, options.session, options.signal)
    }

    async createMany(
        names: string[],
        options: { session?: ClientSession; signal?: AbortSignal } = {}
    ) {
        const docs = names.map((name) => this.draft(name))
        await this.insertMany(docs, options.session, options.signal)
        return docs
    }

    draft(name: string): SampleDraft {
        return Object.assign(this.newDocument(), { name })
    }

    async insertDrafts(docs: SampleDraft[], session?: ClientSession, signal?: AbortSignal) {
        await this.insertMany(docs, session, signal)
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
    await client.connect()

    const customIndexes: IndexDescription[] = [{ key: { name: 1 }, name: 'name_lookup' }]
    const soft = new SamplesRepository(client, 'nativeCrudSoftSamples', { indexes: customIndexes })
    const hard = new SamplesRepository(client, 'nativeCrudHardSamples', { hardDelete: true })
    const projected = new SamplesRepository(client, 'nativeCrudProjectedSamples', {
        projection: { secret: 0 }
    })

    await Promise.all([soft.onModuleInit(), hard.onModuleInit(), projected.onModuleInit()])

    return { client, hard, projected, soft, teardown: () => client.close() }
}

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}
