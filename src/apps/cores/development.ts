import dotenv from 'dotenv'
dotenv.config({ path: ['.env.test'] })
process.env.NODE_ENV = 'development'

import { bootstrap } from './main'
bootstrap()
