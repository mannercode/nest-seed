import { sleep } from 'common'
import * as mongoose from 'mongoose'
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers'

const CONTAINER_IMAGE = process.env.MONGO_DB_IMAGE
if (!CONTAINER_IMAGE) {
    console.error('MONGO_DB_IMAGE is not defined')
    process.exit(1)
}

const NETWORK = process.env.DOCKER_NETWORK
if (!NETWORK) {
    console.error('DOCKER_NETWORK is not defined')
    process.exit(1)
}

const PORT = 27017
const REPLICA_SET_NAME = 'repset'
const USERNAME = 'user'
const PASSWORD = 'pass'
const KEYFILE_VOLUME_NAME = 'mongodb_test_key'

const getName = (container: StartedTestContainer) => container.getName().replace(/^\//, '')

const generateReplicaSetKeyfile = async () => {
    const keyfileGenerator = await new GenericContainer(CONTAINER_IMAGE)
        .withCommand([
            'sh',
            '-c',
            'openssl rand -base64 768 > mongodb.key && chmod 400 mongodb.key && chown mongodb:mongodb mongodb.key'
        ])
        .withWorkingDir('/mongodb_key')
        .withBindMounts([{ source: KEYFILE_VOLUME_NAME, target: '/mongodb_key', mode: 'rw' }])
        .start()

    await keyfileGenerator.stop()
}

const startContainers = async () => {
    return Promise.all(
        Array.from({ length: 3 }, async () => {
            const container = await new GenericContainer(CONTAINER_IMAGE)
                .withEnvironment({
                    MONGO_INITDB_ROOT_USERNAME: USERNAME,
                    MONGO_INITDB_ROOT_PASSWORD: PASSWORD
                })
                .withCommand([
                    'mongod',
                    '--replSet',
                    REPLICA_SET_NAME,
                    '--keyFile',
                    '/etc/mongodb/mongodb.key',
                    '--bind_ip_all'
                ])
                .withBindMounts([{ source: KEYFILE_VOLUME_NAME, target: '/etc/mongodb' }])
                .withWaitStrategy(
                    Wait.forLogMessage(
                        'Start up cluster time keys manager with a local/direct keys client'
                    )
                    // Wait.forLogMessage('MongoDB init process complete; ready for start up.')
                )
                .withNetworkMode(NETWORK)
                .start()

            return container
        })
    )
}

const initiateContainers = async (containers: StartedTestContainer[]) => {
    const initCommand = [
        'sh',
        '-c',
        // `mongosh --host ${containers[0].getHost()} --port ${containers[0].getMappedPort(PORT)} -u ${USERNAME} -p ${PASSWORD} --authenticationDatabase admin --eval ` +
        `mongosh --host ${getName(containers[0])} --port ${PORT} -u ${USERNAME} -p ${PASSWORD} --authenticationDatabase admin --eval ` +
            `"rs.initiate({
          _id: '${REPLICA_SET_NAME}',
          members: [
            {_id: 0, host: '${getName(containers[0])}:${PORT}'},
            {_id: 1, host: '${getName(containers[1])}:${PORT}'},
            {_id: 2, host: '${getName(containers[2])}:${PORT}'}
          ]
        })"`
    ]

    const replicaSetInitiator = await new GenericContainer(CONTAINER_IMAGE)
        .withCommand(initCommand)
        .withWaitStrategy(Wait.forLogMessage('{ ok: 1 }'))
        .withNetworkMode(NETWORK)
        .start()

    await replicaSetInitiator.stop()
}

// Interface representing the MongoDB replica set
export interface MongoContainerContext {
    uri: string
    close: () => Promise<void>
}

// Sets up the MongoDB replica set and returns connection details
export const createMongoContainer = async (): Promise<MongoContainerContext> => {
    await generateReplicaSetKeyfile()
    const containers = await startContainers()

    // await sleep(1000)

    await initiateContainers(containers)

    const uri = `mongodb://${USERNAME}:${PASSWORD}@${getName(containers[0])}:${PORT}/?replicaSet=${REPLICA_SET_NAME}`

    // Connect once to ensure the cluster is fully initialized
    await mongoose.connect(uri, { dbName: 'testdb' })
    const testSchema = new mongoose.Schema({ name: String })
    const TestModel = mongoose.model('Test', testSchema, 'testcol')
    await TestModel.create({ name: 'test' })
    await mongoose.connection.close()

    const close = async () => {
        await Promise.all(containers.map((container) => container.stop()))
    }

    return { uri, close }
}

// docker rm -f $(docker ps -a -q --filter ancestor=mongo:8.0)
