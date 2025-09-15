import { PermissionRules } from "../types/index.js";
import { Logger } from "../utils/Logger.js";
import { SessionManager } from "../utils/SessionManager.js";

export interface PermissionContext {
  toolName: string;
  input: any;
  memberId?: string;
  sessionId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface PermissionResult {
  behavior: 'allow' | 'deny';
  updatedInput?: any;
  message?: string;
  interrupt?: boolean;
  updatedPermissions?: any[];
}

export class PermissionManager {
  private rules: PermissionRules;
  private logger: Logger;
  private sessionManager: SessionManager;
  private auditLog: Array<{
    timestamp: Date;
    context: PermissionContext;
    result: PermissionResult;
    reason: string;
  }> = [];

  constructor(rules: PermissionRules) {
    this.rules = rules;
    this.logger = new Logger('PermissionManager');
    this.sessionManager = new SessionManager();
  }

  getPermissionHandler() {
    return async (toolName: string, input: any, options: any): Promise<PermissionResult> => {
      const context: PermissionContext = {
        toolName,
        input,
        // Extract additional context from options if available
        memberId: options.memberId,
        sessionId: options.sessionId,
        priority: options.priority
      };

      return this.evaluatePermission(context);
    };
  }

  private async evaluatePermission(context: PermissionContext): Promise<PermissionResult> {
    const { toolName, input } = context;

    // Log the permission request
    this.logger.debug(`Permission requested for tool: ${toolName}`, { context });

    try {
      // 1. Check deny rules first (highest priority)
      const denyMatch = this.checkDenyRules(toolName, input);
      if (denyMatch) {
        const result: PermissionResult = {
          behavior: 'deny',
          message: `Tool use denied by rule: ${denyMatch.rule}`,
          interrupt: denyMatch.critical
        };
        this.logDecision(context, result, `Denied by rule: ${denyMatch.rule}`);
        return result;
      }

      // 2. Check allow rules (explicit permissions)
      const allowMatch = this.checkAllowRules(toolName, input);
      if (allowMatch) {
        const result: PermissionResult = {
          behavior: 'allow',
          updatedInput: allowMatch.modifiedInput || input
        };
        this.logDecision(context, result, `Allowed by rule: ${allowMatch.rule}`);
        return result;
      }

      // 3. Check if requires manual approval (ask rules)
      const askMatch = this.checkAskRules(toolName, input);
      if (askMatch) {
        // For SDK, we'll approve with logging since interactive prompts aren't practical
        const result: PermissionResult = {
          behavior: 'allow',
          message: `Tool approved (would normally ask): ${askMatch.rule}`
        };
        this.logDecision(context, result, `Auto-approved ask rule: ${askMatch.rule}`);
        return result;
      }

      // 4. Apply default policy based on tool and context
      const defaultResult = this.applyDefaultPolicy(context);
      this.logDecision(context, defaultResult, 'Applied default policy');
      return defaultResult;

    } catch (error) {
      this.logger.error(`Permission evaluation failed for ${toolName}:`, error);
      const result: PermissionResult = {
        behavior: 'deny',
        message: `Permission evaluation error: ${error.message}`
      };
      this.logDecision(context, result, `Error: ${error.message}`);
      return result;
    }
  }

  private checkDenyRules(toolName: string, input: any): { rule: string; critical: boolean } | null {
    for (const rule of this.rules.deny) {
      if (this.matchesRule(rule, toolName, input)) {
        return {
          rule,
          critical: this.isCriticalRule(rule)
        };
      }
    }
    return null;
  }

  private checkAllowRules(toolName: string, input: any): { rule: string; modifiedInput?: any } | null {
    for (const rule of this.rules.allow) {
      if (this.matchesRule(rule, toolName, input)) {
        return { rule };
      }
    }
    return null;
  }

  private checkAskRules(toolName: string, input: any): { rule: string } | null {
    for (const rule of this.rules.ask) {
      if (this.matchesRule(rule, toolName, input)) {
        return { rule };
      }
    }
    return null;
  }

  private matchesRule(rule: string, toolName: string, input: any): boolean {
    // Parse rule format: ToolName(pattern) or just ToolName
    const ruleMatch = rule.match(/^([^(]+)(?:\(([^)]*)\))?$/);
    if (!ruleMatch) {
      return false;
    }

    const [, ruleToolName, rulePattern] = ruleMatch;

    // Check tool name match
    if (ruleToolName !== toolName && ruleToolName !== '*') {
      return false;
    }

    // If no pattern specified, match any usage of the tool
    if (!rulePattern) {
      return true;
    }

    // Special handling for different tools
    switch (toolName) {
      case 'Bash':
        return this.matchesBashRule(rulePattern, input.command);

      case 'Read':
      case 'Write':
      case 'Edit':
        return this.matchesFileRule(rulePattern, input.file_path);

      case 'WebFetch':
        return this.matchesUrlRule(rulePattern, input.url);

      default:
        // Generic pattern matching
        return this.matchesGenericPattern(rulePattern, JSON.stringify(input));
    }
  }

  private matchesBashRule(pattern: string, command: string): boolean {
    if (!command) return false;

    // Handle wildcards and prefix matching
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -2);
      return command.startsWith(prefix);
    }

    // Exact match
    if (pattern === command) {
      return true;
    }

    // Pattern matching for dangerous commands
    const dangerousPatterns = [
      /^rm\s+-rf\s+\//,
      /curl.*\|\s*sh/,
      /wget.*\|\s*sh/,
      /sudo\s+rm/,
      /dd\s+if=/,
      /:\(\)\{ :\|:& \};:/  // Fork bomb
    ];

    if (pattern === 'dangerous' && dangerousPatterns.some(p => p.test(command))) {
      return true;
    }

    return false;
  }

  private matchesFileRule(pattern: string, filePath: string): boolean {
    if (!filePath) return false;

    // Convert glob pattern to regex
    const regex = this.globToRegex(pattern);
    return regex.test(filePath);
  }

  private matchesUrlRule(pattern: string, url: string): boolean {
    if (!url) return false;

    // Simple URL pattern matching
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(url);
    }

    return url.includes(pattern);
  }

  private matchesGenericPattern(pattern: string, text: string): boolean {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(text);
    }
    return text.includes(pattern);
  }

  private globToRegex(pattern: string): RegExp {
    // Simple glob to regex conversion
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    return new RegExp(`^${regexPattern}$`);
  }

  private isCriticalRule(rule: string): boolean {
    // Rules that should cause immediate interruption
    const criticalPatterns = [
      'Bash(rm -rf',
      'Bash(dangerous)',
      'Write(.env)',
      'Write(./secrets/'
    ];

    return criticalPatterns.some(pattern => rule.includes(pattern));
  }

  private applyDefaultPolicy(context: PermissionContext): PermissionResult {
    const { toolName, input, priority } = context;

    // Safe tools that are generally allowed
    const safeDevelopmentTools = [
      'Read', 'Grep', 'Glob', 'TodoWrite', 'ListMcpResources', 'ReadMcpResource'
    ];

    if (safeDevelopmentTools.includes(toolName)) {
      return { behavior: 'allow' };
    }

    // Editing tools require more careful consideration
    const editingTools = ['Write', 'Edit', 'MultiEdit'];
    if (editingTools.includes(toolName)) {
      // Allow in workspace but be cautious with system files
      if (input.file_path && input.file_path.includes('/workspace/')) {
        return { behavior: 'allow' };
      }
      return {
        behavior: 'deny',
        message: 'File editing outside workspace requires explicit permission'
      };
    }

    // Bash commands need careful evaluation
    if (toolName === 'Bash') {
      const safeCommands = ['ls', 'pwd', 'echo', 'cat', 'head', 'tail', 'grep', 'find'];
      const command = input.command?.split(' ')[0];

      if (safeCommands.includes(command)) {
        return { behavior: 'allow' };
      }

      // High priority tasks get more leeway
      if (priority === 'critical' || priority === 'high') {
        return {
          behavior: 'allow',
          message: 'Bash command approved due to high priority'
        };
      }

      return {
        behavior: 'deny',
        message: 'Bash command requires explicit permission'
      };
    }

    // Default deny for unknown tools
    return {
      behavior: 'deny',
      message: `Tool ${toolName} not in allowed list`
    };
  }

  private logDecision(context: PermissionContext, result: PermissionResult, reason: string): void {
    this.auditLog.push({
      timestamp: new Date(),
      context,
      result,
      reason
    });

    // Log to console for immediate visibility
    const level = result.behavior === 'deny' ? 'warn' : 'info';
    this.logger[level](`Permission ${result.behavior}: ${context.toolName}`, {
      reason,
      memberId: context.memberId,
      sessionId: context.sessionId
    });

    // Keep audit log size manageable
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500);
    }
  }

  async writeSettingsFile(claudeConfigDir: string): Promise<void> {
    const settings = {
      permissions: this.rules,
      team_configuration: {
        audit_permissions: true,
        log_level: process.env.LOG_LEVEL || 'info'
      }
    };

    const settingsPath = `${claudeConfigDir}/settings.json`;
    await this.sessionManager.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    this.logger.info(`Written permission settings to ${settingsPath}`);
  }

  getAuditLog(): typeof this.auditLog {
    return [...this.auditLog];
  }

  generateSecurityReport(): string {
    const denied = this.auditLog.filter(entry => entry.result.behavior === 'deny');
    const allowed = this.auditLog.filter(entry => entry.result.behavior === 'allow');

    const toolUsage = this.auditLog.reduce((acc, entry) => {
      const tool = entry.context.toolName;
      acc[tool] = (acc[tool] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `
Security Report
==============
Total Permission Requests: ${this.auditLog.length}
Allowed: ${allowed.length}
Denied: ${denied.length}

Tool Usage:
${Object.entries(toolUsage)
  .sort(([,a], [,b]) => b - a)
  .map(([tool, count]) => `  ${tool}: ${count}`)
  .join('\n')}

Recent Denials:
${denied.slice(-5).map(entry =>
  `  ${entry.timestamp.toISOString()} - ${entry.context.toolName}: ${entry.reason}`
).join('\n')}
    `.trim();
  }
}