// Input the API passes for one post-PR chat turn. The user's message is already
// persisted as a USER log before the workflow starts.
export interface AgentChatWorkflowInput {
  agentRunId: string;
  projectId: string;
  userId: string;
  message: string;
  kind?: "USER" | "REVALIDATE";
}
