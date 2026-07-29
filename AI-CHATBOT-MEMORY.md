# Self-learning catalog assistant — per-user memory

The catalog shopping assistant remembers its conversations with each member and improves per user over
time. Every member gets their own memory record (an "individual file").

## What it does

- **Remembers every conversation** — each exchange is saved to that member's `AssistantMemory` record
  (a rolling transcript, capped).
- **Learns and self-improves** — every couple of turns the assistant distills durable facts about the
  member (favorite categories, brands, budget hints, style, what to avoid, occasions) into a running
  summary on their file (`learnFromConversation`).
- **Uses what it remembers** — greetings become "welcome back" grounded in past chats, and every reply is
  personalized from the member's accumulated memory plus their KYC answers. The more someone chats, the
  better it knows them.

## How it's wired (backend/sdk/assistant-memory.ts)

`recordTurn()` persists each exchange (always). `learnFromConversation()` re-distills the durable summary
periodically. `memoryContext()` / `hasMemory()` feed the memory into `catalogAssistantChat`'s greeting and
reply prompts. All best-effort — memory never blocks a reply, and distillation only runs when an AI key is
configured. Private and per-member.

## Entity

`AssistantMemory` (one row per user_id; added to schema.sql + entities.json).
