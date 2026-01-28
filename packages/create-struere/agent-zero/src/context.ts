import { defineContext } from '@struere/core'

export const context = defineContext(async (request) => {
  const { conversationId, userId, channel, state } = request

  return {
    additionalContext: `
Current conversation: ${conversationId}
Channel: ${channel}
`,
    variables: {
      userId,
      timestamp: new Date().toISOString(),
    },
  }
})
