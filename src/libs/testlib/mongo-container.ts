import * as mongoose from 'mongoose'
import {
    GenericContainer,
    Network,
    StartedNetwork,
    StartedTestContainer,
    Wait
} from 'testcontainers'

const CONTAINER_IMAGE = process.env.MONGO_DB_IMAGE
if (!CONTAINER_IMAGE) {
    console.error('MONGO_DB_IMAGE is not defined')
    process.exit(1)
}

const PORT = 27017
const REPLICA_SET_NAME = 'repset'
const USERNAME = 'user'
const PASSWORD = 'pass'
const KEYFILE_VOLUME_NAME = 'mongodb_test_key'

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

const startContainers = async (network: StartedNetwork): Promise<StartedTestContainer[]> => {
    return Promise.all(
        Array.from({ length: 3 }, async () => {
            const container = await new GenericContainer(CONTAINER_IMAGE)
                .withExposedPorts(PORT)
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
                    Wait.forLogMessage('MongoDB init process complete; ready for start up.')
                )
                .withNetworkMode(network.getName())
                .start()

            return container
        })
    )
}

const initiateContainers = async (containers: StartedTestContainer[], network: StartedNetwork) => {
    const primaryContainer = containers[0]
    const initCommand = [
        'sh',
        '-c',
        `mongosh --host ${primaryContainer.getHost()} --port ${primaryContainer.getMappedPort(
            PORT
        )} -u ${USERNAME} -p ${PASSWORD} --authenticationDatabase admin --eval ` +
            `"rs.initiate({
          _id: '${REPLICA_SET_NAME}',
          members: [
            {_id: 0, host: '${containers[0].getHost()}:${containers[0].getMappedPort(PORT)}'},
            {_id: 1, host: '${containers[1].getHost()}:${containers[1].getMappedPort(PORT)}'},
            {_id: 2, host: '${containers[2].getHost()}:${containers[2].getMappedPort(PORT)}'}
          ]
        })"`
    ]

    const replicaSetInitiator = await new GenericContainer(CONTAINER_IMAGE)
        .withCommand(initCommand)
        .withWaitStrategy(Wait.forLogMessage('{ ok: 1 }'))
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
    const network = await new Network().start()
    const containers = await startContainers(network)
    await initiateContainers(containers, network)

    const uri = `mongodb://${USERNAME}:${PASSWORD}@${containers[0].getHost()}:${containers[0].getMappedPort(
        PORT
    )}/?replicaSet=${REPLICA_SET_NAME}`

    // Connect once to ensure the cluster is fully initialized
    await mongoose.connect(uri, { dbName: 'testdb' })
    const testSchema = new mongoose.Schema({ name: String })
    const TestModel = mongoose.model('Test', testSchema, 'testcol')
    await TestModel.create({ name: 'test' })
    await mongoose.connection.close()

    const close = async () => {
        await Promise.all(containers.map((container) => container.stop()))
        await network.stop()
    }

    return { uri, close }
}
