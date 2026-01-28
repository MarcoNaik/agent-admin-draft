# Agent Zero

An AI agent built with Struere.

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Set up your environment:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

4. Open http://localhost:3000 to chat with your agent.

## Project Structure

- `src/agent.ts` - Main agent definition (system prompt, model config)
- `src/context.ts` - Dynamic context injection
- `src/tools.ts` - Custom tools for the agent
- `src/workflows/` - Multi-step workflows (coming soon)
- `api/chat.ts` - Vercel Edge API handler for production
- `tests/` - Test conversations
- `af.config.ts` - Framework configuration

## Commands

- `bun run dev` - Start development server with hot reload
- `bun run build` - Build and validate the agent
- `bun run test` - Run test conversations
- `bun run deploy` - Deploy to Struere cloud

## Deploy to Vercel

This project is ready for Vercel deployment:

1. Push to GitHub
2. Import in Vercel
3. Add your `ANTHROPIC_API_KEY` to environment variables
4. Deploy!

The `api/chat.ts` file provides a streaming chat endpoint at `/api/chat`.

## API Usage

Send a POST request to `/api/chat`:

```bash
curl -X POST https://your-app.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "stream": true}'
```

## Documentation

Visit [struere.dev/docs](https://struere.dev/docs) for full documentation.
