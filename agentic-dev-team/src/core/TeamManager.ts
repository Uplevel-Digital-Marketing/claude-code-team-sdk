import { query, tool, createSdkMcpServer } from "@anthropic/claude-code";
import { TeamConfiguration, TeamMember, TaskRequest, TaskResult, TeamSession } from "../types/index.js";
import { CostTracker } from "../utils/CostTracker.js";
import { SessionManager } from "../utils/SessionManager.js";
import { PermissionManager } from "../security/PermissionManager.js";
import { HookManager } from "../hooks/HookManager.js";
import { CustomToolsManager } from "../tools/CustomToolsManager.js";
import { Logger } from "../utils/Logger.js";
import { z } from "zod";

export class TeamManager {
  private config: TeamConfiguration;
  private costTracker: CostTracker;
  private sessionManager: SessionManager;
  private permissionManager: PermissionManager;
  private hookManager: HookManager;
  private customToolsManager: CustomToolsManager;
  private logger: Logger;
  private activeSessions: Map<string, TeamSession> = new Map();

  constructor(config: TeamConfiguration) {
    this.config = config;
    this.costTracker = new CostTracker();
    this.sessionManager = new SessionManager();
    this.permissionManager = new PermissionManager(config.permissionRules);
    this.hookManager = new HookManager(config.hooks);
    this.customToolsManager = new CustomToolsManager();
    this.logger = new Logger('TeamManager');
  }

  async initializeTeam(): Promise<void> {
    this.logger.info('Initializing agentic development team...');

    // Set up workspace
    await this.sessionManager.createWorkspace(this.config.workspace);

    // Initialize Claude configuration directories
    await this.setupClaudeConfiguration();

    // Register custom tools
    await this.customToolsManager.registerTeamTools();

    // Set up MCP servers
    await this.setupMcpServers();

    this.logger.info('Team initialization complete');
  }

  async startTeamSession(sessionName: string): Promise<string> {
    const sessionId = this.sessionManager.generateSessionId();
    const session: TeamSession = {
      id: sessionId,
      name: sessionName,
      startTime: new Date(),
      workspace: this.config.workspace,
      activeMembers: [],
      currentTasks: [],
      completedTasks: [],
      totalCost: 0,
      totalUsage: {}
    };

    this.activeSessions.set(sessionId, session);
    this.logger.info(`Started team session: ${sessionName} (${sessionId})`);

    return sessionId;
  }

  async assignTask(sessionId: string, task: TaskRequest): Promise<string> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Determine best team member for the task
    const assignedMember = this.selectTeamMember(task);
    task.assignedTo = assignedMember.id;

    session.currentTasks.push(task);
    session.activeMembers.push(assignedMember.id);

    this.logger.info(`Assigned ${task.type} task to ${assignedMember.name}`);

    // Execute the task
    const result = await this.executeTask(sessionId, task, assignedMember);

    return result.taskId;
  }

  private async executeTask(
    sessionId: string,
    task: TaskRequest,
    member: TeamMember
  ): Promise<TaskResult> {
    const session = this.activeSessions.get(sessionId)!;
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.info(`Executing task ${taskId} with ${member.name}`);

    try {
      // Create streaming input generator for the task
      async function* generateTaskInput() {
        yield {
          type: "user" as const,
          message: {
            role: "user" as const,
            content: `${task.description}

Files to focus on: ${task.files?.join(', ') || 'entire workspace'}
Priority: ${task.priority}
Dependencies: ${task.dependencies?.join(', ') || 'none'}`
          }
        };
      }

      let result = '';
      let usage: any = {};
      const startTime = Date.now();

      // Execute with member's configuration
      for await (const message of query({
        prompt: generateTaskInput(),
        options: {
          cwd: this.config.workspace,
          customSystemPrompt: member.systemPrompt,
          allowedTools: member.permissions,
          maxTurns: 10,
          mcpServers: this.config.mcpServers,
          canUseTool: this.permissionManager.getPermissionHandler(),
          hooks: this.hookManager.getHooksForMember(member.id),
          includePartialMessages: true
        }
      })) {
        if (message.type === "result" && message.subtype === "success") {
          result = message.result;
          usage = message.usage;
          break;
        }
      }

      const taskResult: TaskResult = {
        taskId,
        status: 'completed',
        result,
        usage,
        cost: this.costTracker.calculateCost(usage),
        duration: Date.now() - startTime
      };

      // Update session
      session.completedTasks.push(taskResult);
      session.totalCost += taskResult.cost || 0;
      session.totalUsage = this.costTracker.aggregateUsage(session.totalUsage, usage);

      this.logger.info(`Task ${taskId} completed successfully`);
      return taskResult;

    } catch (error) {
      this.logger.error(`Task ${taskId} failed:`, error);
      return {
        taskId,
        status: 'failed',
        result: `Task failed: ${error.message}`
      };
    }
  }

  private selectTeamMember(task: TaskRequest): TeamMember {
    // Smart assignment based on task type and member specialization
    const candidates = this.config.members.filter(member =>
      member.specialization.includes(task.type) ||
      member.role.toLowerCase().includes(task.type)
    );

    if (candidates.length === 0) {
      // Fallback to general purpose member
      return this.config.members.find(m => m.role === 'full-stack-developer') ||
             this.config.members[0];
    }

    // Select based on priority and availability
    return candidates[0];
  }

  async executeParallelTasks(sessionId: string, tasks: TaskRequest[]): Promise<TaskResult[]> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.logger.info(`Executing ${tasks.length} tasks in parallel`);

    // Assign members to tasks
    const taskPromises = tasks.map(async (task) => {
      const member = this.selectTeamMember(task);
      task.assignedTo = member.id;
      return this.executeTask(sessionId, task, member);
    });

    // Execute all tasks concurrently
    const results = await Promise.all(taskPromises);

    this.logger.info(`Completed ${results.length} parallel tasks`);
    return results;
  }

  async getSessionStatus(sessionId: string): Promise<TeamSession | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Generate session report
    await this.generateSessionReport(session);

    // Clean up
    this.activeSessions.delete(sessionId);

    this.logger.info(`Ended session ${sessionId}`);
  }

  private async setupClaudeConfiguration(): Promise<void> {
    await this.sessionManager.ensureDirectory(`${this.config.workspace}/.claude`);
    await this.sessionManager.ensureDirectory(`${this.config.workspace}/.claude/agents`);
    await this.sessionManager.ensureDirectory(`${this.config.workspace}/.claude/commands`);
    await this.sessionManager.ensureDirectory(`${this.config.workspace}/.claude/output-styles`);

    // Create settings.json with permission rules
    await this.permissionManager.writeSettingsFile(`${this.config.workspace}/.claude`);

    // Create subagent definitions
    await this.createSubagentFiles();

    // Create slash commands
    await this.createSlashCommands();

    // Create output styles
    await this.createOutputStyles();
  }

  private async setupMcpServers(): Promise<void> {
    // Write .mcp.json configuration
    const mcpConfig = {
      mcpServers: this.config.mcpServers
    };

    await this.sessionManager.writeFile(
      `${this.config.workspace}/.mcp.json`,
      JSON.stringify(mcpConfig, null, 2)
    );
  }

  private async createSubagentFiles(): Promise<void> {
    for (const member of this.config.members) {
      const agentContent = `---
name: ${member.id}
description: ${member.role} - ${member.specialization.join(', ')}
tools: ${member.permissions.join(', ')}
---

${member.systemPrompt}`;

      await this.sessionManager.writeFile(
        `${this.config.workspace}/.claude/agents/${member.id}.md`,
        agentContent
      );
    }
  }

  private async createSlashCommands(): Promise<void> {
    for (const command of this.config.slashCommands) {
      const commandContent = `---
description: ${command.description}
${command.allowedTools ? `allowed-tools: ${command.allowedTools.join(', ')}` : ''}
${command.model ? `model: ${command.model}` : ''}
---

${command.systemPrompt}`;

      await this.sessionManager.writeFile(
        `${this.config.workspace}/.claude/commands/${command.name}.md`,
        commandContent
      );
    }
  }

  private async createOutputStyles(): Promise<void> {
    const styles = [
      {
        name: 'team-leader',
        description: 'Strategic and high-level technical leadership',
        prompt: 'You are a senior technical leader. Focus on architecture, strategy, and team coordination.'
      },
      {
        name: 'code-reviewer',
        description: 'Thorough code review specialist',
        prompt: 'You are an expert code reviewer. Focus on quality, security, performance, and maintainability.'
      },
      {
        name: 'security-auditor',
        description: 'Security-focused analysis and recommendations',
        prompt: 'You are a security expert. Prioritize identifying vulnerabilities and security best practices.'
      }
    ];

    for (const style of styles) {
      const styleContent = `---
name: ${style.name}
description: ${style.description}
---

${style.prompt}`;

      await this.sessionManager.writeFile(
        `${this.config.workspace}/.claude/output-styles/${style.name}.md`,
        styleContent
      );
    }
  }

  private async generateSessionReport(session: TeamSession): Promise<void> {
    const report = {
      sessionId: session.id,
      name: session.name,
      duration: Date.now() - session.startTime.getTime(),
      totalTasks: session.completedTasks.length,
      totalCost: session.totalCost,
      usage: session.totalUsage,
      taskBreakdown: session.completedTasks.map(task => ({
        taskId: task.taskId,
        status: task.status,
        duration: task.duration,
        cost: task.cost
      }))
    };

    await this.sessionManager.writeFile(
      `${this.config.workspace}/reports/session-${session.id}.json`,
      JSON.stringify(report, null, 2)
    );

    this.logger.info(`Generated session report for ${session.id}`);
  }
}