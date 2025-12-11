import dotenv from 'dotenv'
dotenv.config()
process.env.NODE_ENV = 'development'

import { bootstrap } from './main'
void bootstrap()
