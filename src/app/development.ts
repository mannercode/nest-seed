process.env.NODE_ENV = 'development'

import * as dotenv from 'dotenv'
dotenv.config({ path: ['.env.app', '.env.infra'] })

import { bootstrap } from './main'
bootstrap()
