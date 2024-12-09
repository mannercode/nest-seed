import dotenv from 'dotenv'
dotenv.config({ path: ['.env.app', '.env.infra'] })
process.env.NODE_ENV = 'development'

import { bootstrap } from './main'
bootstrap()
