import dotenv from 'dotenv'
import 'reflect-metadata'
dotenv.config({ path: ['.env.test'], quiet: true })
process.env.NODE_ENV = 'test'

const generateTestId = () => {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

    return Array.from(
        { length: 10 },
        () => characters[Math.floor(Math.random() * characters.length)]
    ).join('')
}

global.beforeEach(async () => {
    const testId = generateTestId()

    process.env.TEST_ID = testId
    process.env.PROJECT_ID = `project-${testId}`
    process.env.MONGO_DATABASE = `mongodb-${testId}`
})

process.env.TEST_REDIS_PASSWORD = process.env.REDIS_PASSWORD
process.env.TEST_REDIS_HOST1 = process.env.REDIS_HOST1
process.env.TEST_REDIS_PORT1 = process.env.REDIS_PORT1
process.env.TEST_REDIS_HOST2 = process.env.REDIS_HOST2
process.env.TEST_REDIS_PORT2 = process.env.REDIS_PORT2
process.env.TEST_REDIS_HOST3 = process.env.REDIS_HOST3
process.env.TEST_REDIS_PORT3 = process.env.REDIS_PORT3
process.env.TEST_REDIS_HOST4 = process.env.REDIS_HOST4
process.env.TEST_REDIS_PORT4 = process.env.REDIS_PORT4
process.env.TEST_REDIS_HOST5 = process.env.REDIS_HOST5
process.env.TEST_REDIS_PORT5 = process.env.REDIS_PORT5
process.env.TEST_REDIS_HOST6 = process.env.REDIS_HOST6
process.env.TEST_REDIS_PORT6 = process.env.REDIS_PORT6

process.env.TEST_MONGO_REPLICA = process.env.MONGO_REPLICA
process.env.TEST_MONGO_USERNAME = process.env.MONGO_USERNAME
process.env.TEST_MONGO_PASSWORD = process.env.MONGO_PASSWORD
process.env.TEST_MONGO_HOST1 = process.env.MONGO_HOST1
process.env.TEST_MONGO_PORT1 = process.env.MONGO_PORT1
process.env.TEST_MONGO_HOST2 = process.env.MONGO_HOST2
process.env.TEST_MONGO_PORT2 = process.env.MONGO_PORT2
process.env.TEST_MONGO_HOST3 = process.env.MONGO_HOST3
process.env.TEST_MONGO_PORT3 = process.env.MONGO_PORT3

process.env.TEST_NATS_HOST1 = process.env.NATS_HOST1
process.env.TEST_NATS_PORT1 = process.env.NATS_PORT1
process.env.TEST_NATS_HOST2 = process.env.NATS_HOST2
process.env.TEST_NATS_PORT2 = process.env.NATS_PORT2
process.env.TEST_NATS_HOST3 = process.env.NATS_HOST3
process.env.TEST_NATS_PORT3 = process.env.NATS_PORT3
