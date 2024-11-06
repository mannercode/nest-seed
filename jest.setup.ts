import * as dotenv from 'dotenv'
import 'reflect-metadata'

dotenv.config({ path: ['.env.app', '.env.infra'] })

process.env.NODE_ENV = 'test'
process.env.MONGOMS_VERSION = process.env.MONGO_DB_VERSION
