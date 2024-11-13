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

const startContainers = async (length: number) => {
    return Promise.all(
        Array.from({ length }, async () => {
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
                    /*
                    'MongoDB init process complete; ready for start up.'
                    위 로그 후에 cluster 관련 작업이 완료될 때 까지 기다려야 한다.
                    */
                    Wait.forLogMessage(
                        'Start up cluster time keys manager with a local/direct keys client'
                    )
                )
                .withNetworkMode(NETWORK)
                .start()

            return container
        })
    )
}

const initiateContainers = async (containers: StartedTestContainer[], length: number) => {
    const members = Array.from(
        { length },
        (_, i) => `{ _id: ${i}, host: '${getName(containers[i])}:${PORT}' }`
    ).join(',')

    const initCommand = [
        'sh',
        '-c',
        `mongosh --host ${getName(containers[0])} --port ${PORT} -u ${USERNAME} -p ${PASSWORD} --authenticationDatabase admin --eval ` +
            `"rs.initiate({ _id: '${REPLICA_SET_NAME}', members: [${members}]})"`
    ]

    const replicaSetInitiator = await new GenericContainer(CONTAINER_IMAGE)
        .withCommand(initCommand)
        .withWaitStrategy(Wait.forLogMessage('{ ok: 1 }'))
        .withNetworkMode(NETWORK)
        .start()

    await replicaSetInitiator.stop()
}

const initCluster = async (uri: string) => {
    // 접속을 해야 클러스터 설정을 하는 것 같다.
    await mongoose.connect(uri, { dbName: 'testdb' })
    const testSchema = new mongoose.Schema({ name: String })
    const TestModel = mongoose.model('Test', testSchema, 'testcol')
    await TestModel.create({ name: 'test' })
    await mongoose.connection.close()
}

export interface MongoContainerContext {
    uri: string
    close: () => Promise<void>
}

export const createMongoCluster = async (length: number): Promise<MongoContainerContext> => {
    await generateReplicaSetKeyfile()
    const containers = await startContainers(length)

    await initiateContainers(containers, length)

    const uri = `mongodb://${USERNAME}:${PASSWORD}@${getName(containers[0])}:${PORT}/?replicaSet=${REPLICA_SET_NAME}`

    await initCluster(uri)

    const close = async () => {
        await Promise.all(containers.map((container) => container.stop()))
    }

    return { uri, close }
}
