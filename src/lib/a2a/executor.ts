// A2A AgentExecutor for MoveHome.org. Bridges the @a2a-js/sdk request handler to
// our skill registry: it reads the skill invocation from the incoming message's
// DataPart ({ skill, params }), runs the skill, and publishes a terminal Task
// (completed with artifacts, or failed with a human-readable status message).
//
// MoveHome answers synchronously, so every task we publish is already terminal;
// there is nothing to cancel and we never stream.

import { randomUUID } from 'node:crypto';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import type { Message, Task, TaskStatus, TaskStatusUpdateEvent } from '@a2a-js/sdk';
import { resolveSkill, SkillError, SKILL_IDS, type SkillResult } from './skills';

function agentMessage(text: string, taskId: string, contextId: string): Message {
  return {
    kind: 'message',
    role: 'agent',
    parts: [{ kind: 'text', text }],
    messageId: randomUUID(),
    taskId,
    contextId
  };
}

// Pull the { skill, params } DataPart out of an incoming message/send payload.
function extractSkillInvocation(message: Message): { skill: string; params: unknown } {
  for (const part of message.parts) {
    if (part && part.kind === 'data' && part.data && typeof part.data.skill === 'string') {
      const skill = part.data.skill;
      if (skill.length > 64) {
        throw new SkillError('skill name too long (max 64 chars).');
      }
      const params = (part.data as { params?: unknown }).params ?? {};
      return { skill, params };
    }
  }
  throw new SkillError(
    'No skill invocation found. Include a DataPart: ' +
      '{ "kind": "data", "data": { "skill": "search_properties", "params": { … } } }. ' +
      `Available skills: ${SKILL_IDS.join(', ')}.`
  );
}

class MoveHomeAgentExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const { userMessage, taskId, contextId } = requestContext;
    try {
      const { skill, params } = extractSkillInvocation(userMessage);
      const handler = resolveSkill(skill);
      if (!handler) {
        throw new SkillError(`Unknown skill: ${skill}. Available skills: ${SKILL_IDS.join(', ')}.`);
      }
      const result = await handler(params);
      this.publishCompleted(eventBus, taskId, contextId, result);
    } catch (e) {
      if (e instanceof SkillError) {
        this.publishFailed(eventBus, taskId, contextId, e.message);
      } else {
        console.error('[a2a] executor error', e);
        this.publishFailed(eventBus, taskId, contextId, 'Internal error.');
      }
    }
  }

  // Synchronous request/response only — there is no long-running task to cancel.
  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    // no-op
  }

  private publishCompleted(
    eventBus: ExecutionEventBus,
    taskId: string,
    contextId: string,
    result: SkillResult
  ): void {
    const status: TaskStatus = {
      state: 'completed',
      message: agentMessage(result.summary, taskId, contextId),
      timestamp: new Date().toISOString()
    };
    this.publishTerminal(eventBus, {
      kind: 'task',
      id: taskId,
      contextId,
      status,
      artifacts: result.artifacts
    });
  }

  private publishFailed(
    eventBus: ExecutionEventBus,
    taskId: string,
    contextId: string,
    message: string
  ): void {
    const status: TaskStatus = {
      state: 'failed',
      message: agentMessage(message, taskId, contextId),
      timestamp: new Date().toISOString()
    };
    this.publishTerminal(eventBus, { kind: 'task', id: taskId, contextId, status });
  }

  private publishTerminal(eventBus: ExecutionEventBus, task: Task): void {
    eventBus.publish(task);
    const update: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId: task.id,
      contextId: task.contextId,
      status: task.status,
      final: true
    };
    eventBus.publish(update);
    eventBus.finished();
  }
}

export const moveHomeExecutor: AgentExecutor = new MoveHomeAgentExecutor();
