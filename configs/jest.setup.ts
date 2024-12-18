import dotenv from 'dotenv'
dotenv.config({ path: ['.env.app', '.env.infra'] })
process.env.NODE_ENV = 'test'

import 'reflect-metadata'

process.env.TEST_REDIS_HOST1 = process.env.REDIS_HOST1
process.env.TEST_REDIS_HOST2 = process.env.REDIS_HOST2
process.env.TEST_REDIS_HOST3 = process.env.REDIS_HOST3
process.env.TEST_REDIS_HOST4 = process.env.REDIS_HOST4
process.env.TEST_REDIS_HOST5 = process.env.REDIS_HOST5
process.env.TEST_REDIS_HOST6 = process.env.REDIS_HOST6
process.env.TEST_REDIS_PORT = process.env.REDIS_PORT
process.env.TEST_REDIS_PASSWORD = process.env.REDIS_PASSWORD

process.env.TEST_MONGO_DB_HOST1 = process.env.MONGO_DB_HOST1
process.env.TEST_MONGO_DB_HOST2 = process.env.MONGO_DB_HOST2
process.env.TEST_MONGO_DB_HOST3 = process.env.MONGO_DB_HOST3
process.env.TEST_MONGO_DB_PORT = process.env.MONGO_DB_PORT
process.env.TEST_MONGO_DB_REPLICA_NAME = process.env.MONGO_DB_REPLICA_NAME
process.env.TEST_MONGO_DB_USERNAME = process.env.MONGO_DB_USERNAME
process.env.TEST_MONGO_DB_PASSWORD = process.env.MONGO_DB_PASSWORD
