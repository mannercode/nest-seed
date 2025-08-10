import dotenv from 'dotenv'
dotenv.config({ path: ['.env.test'] })
process.env.NODE_ENV = 'development'
process.env.HTTP_PORT = '4002'

import { bootstrap } from './main'
bootstrap()
