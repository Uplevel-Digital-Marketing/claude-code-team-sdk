import { HookConfiguration, HookMatcher, HookCallback } from "../types/index.js";
import { Logger } from "../utils/Logger.js";
import { CostTracker } from "../utils/CostTracker.js";

export interface HookInput {
  hook_event_name: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode?: string;
  tool_name?: string;
  tool_input?: any;
  tool_response?: any;
  message?: string;
  title?: string;
  prompt?: string;
  source?: string;
  reason?: string;
  stop_hook_active?: boolean;
  trigger?: string;
  custom_instructions?: string;
}

export interface HookOutput {
  continue?: boolean;
  suppressOutput?: boolean;
  stopReason?: string;
  decision?: 'approve' | 'block';
  systemMessage?: string;
  reason?: string;
  async?: boolean;
  asyncTimeout?: number;
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
    additionalContext?: string;
  };
}

export class HookManager {
  private configuration: HookConfiguration;
  private logger: Logger;
  private costTracker: CostTracker;
  private eventMetrics: Map<string, number> = new Map();
  private executionHistory: Array<{
    timestamp: Date;
    event: string;
    memberId?: string;
    success: boolean;
    duration: number;
    output?: HookOutput;
  }> = [];

  constructor(configuration: HookConfiguration) {
    this.configuration = configuration;
    this.logger = new Logger('HookManager');
    this.costTracker = new CostTracker();
    this.initializeHooks();
  }

  private initializeHooks(): void {
    // Register built-in team coordination hooks
    this.registerBuiltInHooks();

    this.logger.info('Hook manager initialized with configuration');
  }

  getHooksForMember(memberId: string): any {
    // Return hooks configuration adapted for the SDK format
    const sdkHooks: any = {};

    Object.entries(this.configuration).forEach(([event, matchers]) => {
      sdkHooks[event] = matchers.map(matcher => ({
        matcher: matcher.matcher,
        hooks: matcher.hooks.map(hookCallback =>
          this.createSdkHookHandler(event, hookCallback, memberId)
        )
      }));
    });

    return sdkHooks;
  }

  private createSdkHookHandler(
    eventName: string,
    hookCallback: HookCallback,
    memberId: string
  ) {
    return async (input: HookInput, toolUseId: string | undefined, options: { signal: AbortSignal }): Promise<HookOutput> => {
      const startTime = Date.now();

      try {
        this.logger.debug(`Executing hook ${hookCallback.name} for event ${eventName}`, {
          memberId,
          toolUseId
        });

        // Execute the hook
        const result = await hookCallback.handler(input, toolUseId, { ...options, memberId });

        const duration = Date.now() - startTime;
        this.recordExecution(eventName, memberId, true, duration, result);

        return result;

      } catch (error) {
        const duration = Date.now() - startTime;
        this.logger.error(`Hook ${hookCallback.name} failed:`, error);
        this.recordExecution(eventName, memberId, false, duration);

        // Return safe default on error
        return { continue: true };
      }
    };
  }

  private registerBuiltInHooks(): void {
    // Pre-tool use security and logging
    this.addHook('PreToolUse', {
      name: 'security-audit',
      handler: async (input: HookInput) => {
        if (input.tool_name === 'Bash') {
          const command = input.tool_input?.command || '';

          // Check for dangerous commands
          const dangerousPatterns = [
            /rm\s+-rf\s+\/(?!.*workspace)/,
            /sudo\s+/,
            /curl.*\|\s*sh/,
            /wget.*\|\s*sh/,
            /dd\s+if=/
          ];

          if (dangerousPatterns.some(pattern => pattern.test(command))) {
            this.logger.warn(`Dangerous command blocked: ${command}`);
            return {
              decision: 'block',
              reason: 'Command poses security risk',
              hookSpecificOutput: {
                hookEventName: 'PreToolUse',
                permissionDecision: 'deny',
                permissionDecisionReason: 'Security policy violation'
              }
            };
          }
        }

        return { continue: true };
      }
    });

    // Post-tool use logging and metrics
    this.addHook('PostToolUse', {
      name: 'metrics-collector',
      handler: async (input: HookInput) => {
        if (input.tool_name) {
          const count = this.eventMetrics.get(input.tool_name) || 0;
          this.eventMetrics.set(input.tool_name, count + 1);
        }

        // Log successful tool use
        this.logger.info(`Tool completed: ${input.tool_name}`, {
          sessionId: input.session_id,
          success: true
        });

        return { continue: true };
      }
    });

    // Session start initialization
    this.addHook('SessionStart', {
      name: 'session-initializer',
      handler: async (input: HookInput) => {
        this.logger.info(`Session started: ${input.session_id}`, {
          source: input.source,
          cwd: input.cwd
        });

        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: 'Team session initialized with security monitoring'
          }
        };
      }
    });

    // Session end cleanup
    this.addHook('SessionEnd', {
      name: 'session-cleanup',
      handler: async (input: HookInput) => {
        this.logger.info(`Session ended: ${input.session_id}`, {
          reason: input.reason
        });

        // Generate session metrics
        const metrics = this.generateSessionMetrics();
        this.logger.info('Session metrics:', metrics);

        return { continue: true };
      }
    });

    // User prompt analysis
    this.addHook('UserPromptSubmit', {
      name: 'prompt-analyzer',
      handler: async (input: HookInput) => {
        const prompt = input.prompt || '';

        // Analyze prompt for task classification
        const taskTypes = {
          security: /security|vulnerability|audit|penetration|attack/i,
          performance: /performance|optimize|slow|fast|benchmark/i,
          testing: /test|unit|integration|coverage|mock/i,
          deployment: /deploy|production|release|ci\/cd|docker/i,
          debugging: /debug|error|bug|fix|issue|problem/i
        };

        const detectedTasks = Object.entries(taskTypes)
          .filter(([, pattern]) => pattern.test(prompt))
          .map(([task]) => task);

        if (detectedTasks.length > 0) {
          this.logger.info(`Detected task types: ${detectedTasks.join(', ')}`, {
            sessionId: input.session_id
          });

          return {
            continue: true,
            hookSpecificOutput: {
              hookEventName: 'UserPromptSubmit',
              additionalContext: `Detected specialized tasks: ${detectedTasks.join(', ')}`
            }
          };
        }

        return { continue: true };
      }
    });

    // Pre-compaction hook for context management
    this.addHook('PreCompact', {
      name: 'context-preserver',
      handler: async (input: HookInput) => {
        this.logger.info(`Context compaction triggered: ${input.trigger}`, {
          sessionId: input.session_id
        });

        // Could implement custom context preservation logic here
        return { continue: true };
      }
    });
  }

  private addHook(event: keyof HookConfiguration, hookCallback: HookCallback): void {
    if (!this.configuration[event]) {
      this.configuration[event] = [];
    }

    // Add to existing matchers or create new one
    const existingMatcher = this.configuration[event].find(m => !m.matcher);
    if (existingMatcher) {
      existingMatcher.hooks.push(hookCallback);
    } else {
      this.configuration[event].push({
        hooks: [hookCallback]
      });
    }
  }

  addCustomHook(
    event: keyof HookConfiguration,
    matcher: string | undefined,
    hookCallback: HookCallback
  ): void {
    if (!this.configuration[event]) {
      this.configuration[event] = [];
    }

    const existingMatcher = this.configuration[event].find(m => m.matcher === matcher);
    if (existingMatcher) {
      existingMatcher.hooks.push(hookCallback);
    } else {
      this.configuration[event].push({
        matcher,
        hooks: [hookCallback]
      });
    }

    this.logger.info(`Added custom hook ${hookCallback.name} for ${event}`, { matcher });
  }

  private recordExecution(
    event: string,
    memberId: string | undefined,
    success: boolean,
    duration: number,
    output?: HookOutput
  ): void {
    this.executionHistory.push({
      timestamp: new Date(),
      event,
      memberId,
      success,
      duration,
      output
    });

    // Keep history manageable
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-500);
    }
  }

  private generateSessionMetrics(): any {
    const recent = this.executionHistory.filter(
      h => Date.now() - h.timestamp.getTime() < 3600000 // Last hour
    );

    return {
      totalHooksExecuted: recent.length,
      successRate: recent.length > 0 ?
        (recent.filter(h => h.success).length / recent.length) * 100 : 0,
      averageExecutionTime: recent.length > 0 ?
        recent.reduce((sum, h) => sum + h.duration, 0) / recent.length : 0,
      toolUsage: Object.fromEntries(this.eventMetrics),
      eventBreakdown: recent.reduce((acc, h) => {
        acc[h.event] = (acc[h.event] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  getExecutionHistory(): typeof this.executionHistory {
    return [...this.executionHistory];
  }

  getMetrics(): {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    eventBreakdown: Record<string, number>;
    toolUsage: Record<string, number>;
  } {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(h => h.success).length;
    const totalDuration = this.executionHistory.reduce((sum, h) => sum + h.duration, 0);

    const eventBreakdown = this.executionHistory.reduce((acc, h) => {
      acc[h.event] = (acc[h.event] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExecutions: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageExecutionTime: total > 0 ? totalDuration / total : 0,
      eventBreakdown,
      toolUsage: Object.fromEntries(this.eventMetrics)
    };
  }

  generateHookReport(): string {
    const metrics = this.getMetrics();
    const recentErrors = this.executionHistory
      .filter(h => !h.success)
      .slice(-5);

    return `
Hook Execution Report
====================
Total Executions: ${metrics.totalExecutions}
Success Rate: ${metrics.successRate.toFixed(2)}%
Average Execution Time: ${metrics.averageExecutionTime.toFixed(2)}ms

Event Breakdown:
${Object.entries(metrics.eventBreakdown)
  .sort(([,a], [,b]) => b - a)
  .map(([event, count]) => `  ${event}: ${count}`)
  .join('\n')}

Tool Usage:
${Object.entries(metrics.toolUsage)
  .sort(([,a], [,b]) => b - a)
  .map(([tool, count]) => `  ${tool}: ${count}`)
  .join('\n')}

Recent Errors:
${recentErrors.map(error =>
  `  ${error.timestamp.toISOString()} - ${error.event} (${error.duration}ms)`
).join('\n')}
    `.trim();
  }
}