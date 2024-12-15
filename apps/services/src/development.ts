import dotenv from 'dotenv'
dotenv.config({ path: ['.env.rule', '.env.app'] })
process.env.NODE_ENV = 'development'

import { bootstrap } from './main'
bootstrap()
