-- Add an explicit state for runs paused on generated agent clarification.
ALTER TYPE "FixRunState" ADD VALUE IF NOT EXISTS 'WAITING_FOR_INPUT';
