import agent from '../src/agent'
import { createVercelHandler } from '@struere/runtime/serverless/vercel'

export default createVercelHandler(agent, {
  streaming: true,
  corsOrigins: ['*'],
})

export const config = {
  runtime: 'edge',
}
