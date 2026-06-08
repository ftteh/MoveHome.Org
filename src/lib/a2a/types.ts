// Wire types for the Google Agent2Agent (A2A) protocol surface MoveHome.org
// exposes so external AI agents can discover and transact over listings.
//
// We implement the JSON-RPC subset MoveHome needs (message/send, tasks/get)
// rather than depending on an SDK — the type surface is small and zod-validated
// at the route boundary. Field names follow the A2A spec (protocolVersion 0.2.x):
// parts carry a `kind` discriminator, tasks carry a status + artifacts.

export const A2A_PROTOCOL_VERSION = '0.2.5';

// ── Message parts ───────────────────────────────────────────────────────────
export interface TextPart {
  kind: 'text';
  text: string;
}

export interface DataPart {
  kind: 'data';
  data: Record<string, unknown>;
}

export type Part = TextPart | DataPart;

// ── Messages ────────────────────────────────────────────────────────────────
export type Role = 'user' | 'agent';

export interface Message {
  kind: 'message';
  role: Role;
  parts: Part[];
  messageId: string;
  taskId?: string;
  contextId?: string;
}

// ── Tasks ───────────────────────────────────────────────────────────────────
// MoveHome answers synchronously, so every task we return is already terminal
// (completed | failed | input-required). We do not persist tasks in v1.
export type TaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'rejected';

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp: string;
}

export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
}

export interface Task {
  kind: 'task';
  id: string;
  contextId: string;
  status: TaskStatus;
  artifacts?: Artifact[];
  history?: Message[];
}

// ── Agent Card ──────────────────────────────────────────────────────────────
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
  inputModes?: string[];
  outputModes?: string[];
}

export interface AgentCapabilities {
  streaming: boolean;
  pushNotifications: boolean;
  stateTransitionHistory: boolean;
}

export interface AgentProvider {
  organization: string;
  url: string;
}

export interface AgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  preferredTransport: 'JSONRPC';
  version: string;
  provider: AgentProvider;
  documentationUrl?: string;
  capabilities: AgentCapabilities;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
}
