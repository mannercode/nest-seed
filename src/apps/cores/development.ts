import dotenv from 'dotenv'
import { bootstrap } from './main'

dotenv.config()
process.env.NODE_ENV = 'development'
process.env.HTTP_PORT = '4001'

void bootstrap()
