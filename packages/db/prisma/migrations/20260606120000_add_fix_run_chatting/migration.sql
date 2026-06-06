-- Add a state for runs actively processing a post-PR agent chat message.
ALTER TYPE "FixRunState" ADD VALUE IF NOT EXISTS 'CHATTING';
