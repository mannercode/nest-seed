import dotenv from 'dotenv'
dotenv.config()
process.env.NODE_ENV = 'development'
process.env.HTTP_PORT = '4001'

import { bootstrap } from './main'
void bootstrap()
