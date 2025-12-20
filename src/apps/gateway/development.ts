import dotenv from 'dotenv'
import { bootstrap } from './main'

dotenv.config()
process.env.NODE_ENV = 'development'

void bootstrap()
