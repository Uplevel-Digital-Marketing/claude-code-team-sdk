import { AgenticDevTeam } from '../../src/index.js';
import path from 'path';
import fs from 'fs-extra';

// Mock Claude Code SDK for E2E tests
jest.mock('@anthropic/claude-code', () => ({
  query: jest.fn().mockImplementation(async function* ({ prompt, options }) {
    // Simulate different responses based on task type
    const promptText = typeof prompt === 'string' ? prompt : 'task';

    if (promptText.includes('security') || promptText.includes('audit')) {
      yield {
        type: 'result',
        subtype: 'success',
        result: 'Security audit completed. No critical vulnerabilities found.',
        usage: { input_tokens: 150, output_tokens: 300, total_cost_usd: 0.025 }
      };
    } else if (promptText.includes('test')) {
      yield {
        type: 'result',
        subtype: 'success',
        result: 'Test suite completed. 42 tests passed, 0 failed.',
        usage: { input_tokens: 100, output_tokens: 200, total_cost_usd: 0.018 }
      };
    } else if (promptText.includes('deploy')) {
      yield {
        type: 'result',
        subtype: 'success',
        result: 'Deployment to staging successful. Application is running.',
        usage: { input_tokens: 120, output_tokens: 250, total_cost_usd: 0.022 }
      };
    } else {
      yield {
        type: 'result',
        subtype: 'success',
        result: `Task completed: ${promptText}`,
        usage: { input_tokens: 100, output_tokens: 200, total_cost_usd: 0.015 }
      };
    }
  }),
  tool: jest.fn(),
  createSdkMcpServer: jest.fn().mockReturnValue({
    name: 'mock-server',
    tools: []
  })
}));

describe('AgenticDevTeam E2E Tests', () => {
  let team: AgenticDevTeam;
  let testWorkspace: string;

  beforeAll(async () => {
    testWorkspace = path.join(process.cwd(), 'tests', 'fixtures', 'e2e-workspace');
    await fs.ensureDir(testWorkspace);
    process.env.TEAM_WORKSPACE = testWorkspace;
  });

  afterAll(async () => {
    await fs.remove(testWorkspace);
  });

  beforeEach(async () => {
    team = new AgenticDevTeam();
    await team.initialize();
  });

  describe('Full Project Lifecycle', () => {
    it('should handle complete project from start to finish', async () => {
      // Start new project
      const sessionId = await team.startNewProject('E2E Test Project');
      expect(sessionId).toBeTruthy();

      // Execute various types of tasks
      const implementationTaskId = await team.executeTaskRequest(
        sessionId,
        'Implement user authentication system',
        'implementation'
      );
      expect(implementationTaskId).toBeTruthy();

      const analysisTaskId = await team.executeTaskRequest(
        sessionId,
        'Analyze performance bottlenecks',
        'analysis'
      );
      expect(analysisTaskId).toBeTruthy();

      // Run code review
      const reviewTaskId = await team.runCodeReview(sessionId, ['src/auth.ts', 'src/api.ts']);
      expect(reviewTaskId).toBeTruthy();

      // Deploy to staging
      const deployTaskIds = await team.deployToStaging(sessionId);
      expect(deployTaskIds).toBeTruthy();
      expect(deployTaskIds.split(', ')).toHaveLength(2); // Test + Deploy tasks

      // Check project status
      const status = await team.getProjectStatus(sessionId);
      expect(status).toBeTruthy();
      expect(status!.completedTasks.length).toBeGreaterThan(0);
      expect(status!.totalCost).toBeGreaterThan(0);

      // End project
      await team.endProject(sessionId);

      // Verify session ended
      const finalStatus = await team.getProjectStatus(sessionId);
      expect(finalStatus).toBeNull();
    }, 60000);

    it('should demonstrate full development cycle', async () => {
      await expect(
        team.runFullDevelopmentCycle('Demo Development Cycle')
      ).resolves.not.toThrow();
    }, 120000);

    it('should demonstrate team capabilities', async () => {
      await expect(
        team.demonstrateTeamCapabilities()
      ).resolves.not.toThrow();
    }, 180000);
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent projects', async () => {
      const project1Promise = team.startNewProject('Concurrent Project 1');
      const project2Promise = team.startNewProject('Concurrent Project 2');
      const project3Promise = team.startNewProject('Concurrent Project 3');

      const [sessionId1, sessionId2, sessionId3] = await Promise.all([
        project1Promise,
        project2Promise,
        project3Promise
      ]);

      expect(sessionId1).toBeTruthy();
      expect(sessionId2).toBeTruthy();
      expect(sessionId3).toBeTruthy();
      expect(new Set([sessionId1, sessionId2, sessionId3]).size).toBe(3);

      // Execute tasks concurrently
      const taskPromises = [
        team.executeTaskRequest(sessionId1, 'Task 1 for project 1'),
        team.executeTaskRequest(sessionId2, 'Task 1 for project 2'),
        team.executeTaskRequest(sessionId3, 'Task 1 for project 3')
      ];

      const taskIds = await Promise.all(taskPromises);
      expect(taskIds).toHaveLength(3);
      taskIds.forEach(id => expect(id).toBeTruthy());

      // Clean up
      await Promise.all([
        team.endProject(sessionId1),
        team.endProject(sessionId2),
        team.endProject(sessionId3)
      ]);
    }, 90000);
  });

  describe('Error Recovery', () => {
    it('should handle API failures gracefully', async () => {
      // Mock a failing query for this test
      const { query } = require('@anthropic/claude-code');
      const originalQuery = query;

      query.mockImplementationOnce(async function* () {
        throw new Error('Simulated API failure');
      });

      const sessionId = await team.startNewProject('Error Recovery Test');

      // This should not throw, but handle the error gracefully
      const taskId = await team.executeTaskRequest(
        sessionId,
        'Task that will fail',
        'implementation'
      );

      expect(taskId).toBeTruthy();

      const status = await team.getProjectStatus(sessionId);
      const failedTask = status!.completedTasks.find(t => t.taskId === taskId);
      expect(failedTask!.status).toBe('failed');

      // Restore original mock
      query.mockImplementation(originalQuery);

      await team.endProject(sessionId);
    });

    it('should validate input parameters', async () => {
      await expect(
        team.executeTaskRequest('invalid-session-id', 'Some task')
      ).rejects.toThrow();

      await expect(
        team.runCodeReview('invalid-session-id')
      ).rejects.toThrow();

      await expect(
        team.deployToStaging('invalid-session-id')
      ).rejects.toThrow();
    });
  });

  describe('Resource Management', () => {
    it('should properly initialize and clean up resources', async () => {
      const sessionId = await team.startNewProject('Resource Test');

      // Verify workspace structure
      expect(await fs.pathExists(path.join(testWorkspace, '.claude'))).toBe(true);
      expect(await fs.pathExists(path.join(testWorkspace, 'reports'))).toBe(true);

      // Execute some tasks to generate data
      await team.executeTaskRequest(sessionId, 'Test resource management');

      // End project and verify cleanup
      await team.endProject(sessionId);

      // Reports should be generated
      const reportsDir = path.join(testWorkspace, 'reports');
      const reportFiles = await fs.readdir(reportsDir);
      const sessionReport = reportFiles.find(f => f.includes(sessionId));
      expect(sessionReport).toBeTruthy();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate team configuration', async () => {
      // This test ensures the team initializes with proper configuration
      expect(team).toBeTruthy();

      // Verify configuration files were created
      const configFiles = [
        '.claude/settings.json',
        '.claude/agents/senior-architect.md',
        '.claude/commands/architect-review.md',
        '.claude/output-styles/team-leader.md'
      ];

      for (const configFile of configFiles) {
        const fullPath = path.join(testWorkspace, configFile);
        expect(await fs.pathExists(fullPath)).toBe(true);
      }
    });
  });
});