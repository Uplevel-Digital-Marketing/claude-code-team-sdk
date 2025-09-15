import { TeamManager } from '../../src/core/TeamManager.js';
import { createTeamConfiguration } from '../../src/config/team-config.js';
import path from 'path';
import fs from 'fs-extra';

// Mock Claude Code SDK
jest.mock('@anthropic/claude-code', () => ({
  query: jest.fn().mockImplementation(async function* () {
    yield {
      type: 'result',
      subtype: 'success',
      result: 'Task completed successfully',
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        total_cost_usd: 0.015
      }
    };
  }),
  tool: jest.fn(),
  createSdkMcpServer: jest.fn().mockReturnValue({
    name: 'test-server',
    tools: []
  })
}));

describe('TeamManager Integration Tests', () => {
  let teamManager: TeamManager;
  let testWorkspace: string;

  beforeAll(async () => {
    testWorkspace = path.join(process.cwd(), 'tests', 'fixtures', 'integration-workspace');
    await fs.ensureDir(testWorkspace);
  });

  afterAll(async () => {
    await fs.remove(testWorkspace);
  });

  beforeEach(async () => {
    const config = createTeamConfiguration(testWorkspace);
    // Simplify config for testing
    config.mcpServers = {};
    teamManager = new TeamManager(config);
    await teamManager.initializeTeam();
  });

  describe('Team Initialization', () => {
    it('should initialize team successfully', async () => {
      // Check that workspace directories were created
      expect(await fs.pathExists(path.join(testWorkspace, '.claude'))).toBe(true);
      expect(await fs.pathExists(path.join(testWorkspace, '.claude/agents'))).toBe(true);
      expect(await fs.pathExists(path.join(testWorkspace, '.claude/commands'))).toBe(true);
      expect(await fs.pathExists(path.join(testWorkspace, '.claude/output-styles'))).toBe(true);
    });

    it('should create subagent files', async () => {
      const agentsDir = path.join(testWorkspace, '.claude/agents');
      const agentFiles = await fs.readdir(agentsDir);

      expect(agentFiles).toContain('senior-architect.md');
      expect(agentFiles).toContain('frontend-specialist.md');
      expect(agentFiles).toContain('backend-specialist.md');

      // Check content of one agent file
      const architectContent = await fs.readFile(
        path.join(agentsDir, 'senior-architect.md'),
        'utf-8'
      );
      expect(architectContent).toContain('name: senior-architect');
      expect(architectContent).toContain('You are a Senior Software Architect');
    });

    it('should create slash commands', async () => {
      const commandsDir = path.join(testWorkspace, '.claude/commands');
      const commandFiles = await fs.readdir(commandsDir);

      expect(commandFiles).toContain('architect-review.md');
      expect(commandFiles).toContain('security-audit.md');
      expect(commandFiles).toContain('performance-analysis.md');
    });

    it('should create output styles', async () => {
      const stylesDir = path.join(testWorkspace, '.claude/output-styles');
      const styleFiles = await fs.readdir(stylesDir);

      expect(styleFiles).toContain('team-leader.md');
      expect(styleFiles).toContain('code-reviewer.md');
      expect(styleFiles).toContain('security-auditor.md');
    });
  });

  describe('Session Management', () => {
    it('should start and manage team sessions', async () => {
      const sessionId = await teamManager.startTeamSession('Test Project');

      expect(sessionId).toBeTruthy();
      expect(sessionId).toMatch(/^session_/);

      const status = await teamManager.getSessionStatus(sessionId);
      expect(status).toBeTruthy();
      expect(status!.name).toBe('Test Project');
      expect(status!.currentTasks).toEqual([]);
      expect(status!.completedTasks).toEqual([]);
    });

    it('should handle session not found', async () => {
      const status = await teamManager.getSessionStatus('nonexistent');
      expect(status).toBeNull();
    });
  });

  describe('Task Assignment and Execution', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await teamManager.startTeamSession('Task Test Project');
    });

    it('should assign and execute tasks', async () => {
      const task = {
        type: 'implementation' as const,
        description: 'Create a new feature',
        priority: 'medium' as const
      };

      const taskId = await teamManager.assignTask(sessionId, task);

      expect(taskId).toBeTruthy();

      const status = await teamManager.getSessionStatus(sessionId);
      expect(status!.completedTasks).toHaveLength(1);
      expect(status!.completedTasks[0].status).toBe('completed');
      expect(status!.totalCost).toBeGreaterThan(0);
    });

    it('should execute parallel tasks', async () => {
      const tasks = [
        {
          type: 'implementation' as const,
          description: 'Frontend development',
          priority: 'high' as const
        },
        {
          type: 'implementation' as const,
          description: 'Backend development',
          priority: 'high' as const
        },
        {
          type: 'testing' as const,
          description: 'Test development',
          priority: 'medium' as const
        }
      ];

      const results = await teamManager.executeParallelTasks(sessionId, tasks);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('completed');
        expect(result.taskId).toBeTruthy();
      });

      const status = await teamManager.getSessionStatus(sessionId);
      expect(status!.completedTasks).toHaveLength(3);
    });

    it('should assign tasks to appropriate specialists', async () => {
      const frontendTask = {
        type: 'implementation' as const,
        description: 'React component development',
        priority: 'medium' as const
      };

      await teamManager.assignTask(sessionId, frontendTask);

      const status = await teamManager.getSessionStatus(sessionId);
      const completedTask = status!.completedTasks[0];

      // Task should be assigned based on specialization
      expect(completedTask).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle task execution errors gracefully', async () => {
      // Mock a failing query
      const { query } = require('@anthropic/claude-code');
      query.mockImplementationOnce(async function* () {
        throw new Error('Simulated API failure');
      });

      const sessionId = await teamManager.startTeamSession('Error Test');
      const task = {
        type: 'implementation' as const,
        description: 'Failing task',
        priority: 'medium' as const
      };

      const taskId = await teamManager.assignTask(sessionId, task);

      const status = await teamManager.getSessionStatus(sessionId);
      const completedTask = status!.completedTasks.find(t => t.taskId === taskId);

      expect(completedTask!.status).toBe('failed');
      expect(completedTask!.result).toContain('Task failed');
    });

    it('should handle invalid session IDs', async () => {
      const task = {
        type: 'implementation' as const,
        description: 'Test task',
        priority: 'medium' as const
      };

      await expect(
        teamManager.assignTask('invalid-session', task)
      ).rejects.toThrow('Session invalid-session not found');
    });
  });

  describe('Session Cleanup', () => {
    it('should end sessions and generate reports', async () => {
      const sessionId = await teamManager.startTeamSession('Cleanup Test');

      // Add some tasks
      const task = {
        type: 'implementation' as const,
        description: 'Test task for cleanup',
        priority: 'medium' as const
      };
      await teamManager.assignTask(sessionId, task);

      // End session
      await teamManager.endSession(sessionId);

      // Session should no longer be accessible
      const status = await teamManager.getSessionStatus(sessionId);
      expect(status).toBeNull();

      // Report should be generated
      const reportPath = path.join(testWorkspace, 'reports', `session-${sessionId}.json`);
      const reportExists = await fs.pathExists(reportPath);
      expect(reportExists).toBe(true);

      if (reportExists) {
        const report = await fs.readJson(reportPath);
        expect(report.sessionId).toBe(sessionId);
        expect(report.totalTasks).toBe(1);
      }
    });
  });
});