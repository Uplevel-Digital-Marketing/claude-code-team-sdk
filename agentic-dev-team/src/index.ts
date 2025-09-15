import dotenv from 'dotenv';
import path from 'path';
import { TeamManager } from './core/TeamManager.js';
import { createTeamConfiguration } from './config/team-config.js';
import { CustomToolsManager } from './tools/CustomToolsManager.js';
import { Logger } from './utils/Logger.js';

// Load environment variables
dotenv.config();

export class AgenticDevTeam {
  private teamManager!: TeamManager;
  private logger: Logger;
  private customToolsManager: CustomToolsManager;

  constructor() {
    this.logger = new Logger('AgenticDevTeam');
    this.customToolsManager = new CustomToolsManager();
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Agentic Development Team...');

      // Setup workspace
      const workspace = process.env.TEAM_WORKSPACE || path.join(process.cwd(), 'workspace');

      // Register custom tools first
      const mcpServers = await this.customToolsManager.registerTeamTools();

      // Create team configuration
      const config = createTeamConfiguration(workspace);
      config.mcpServers = mcpServers;

      // Initialize team manager
      this.teamManager = new TeamManager(config);
      await this.teamManager.initializeTeam();

      this.logger.info('Agentic Development Team initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize team:', error);
      throw error;
    }
  }

  async startNewProject(projectName: string): Promise<string> {
    try {
      this.logger.info(`Starting new project: ${projectName}`);

      const sessionId = await this.teamManager.startTeamSession(projectName);

      // Initial project setup tasks
      const setupTasks = [
        {
          type: 'analysis' as const,
          description: 'Analyze project requirements and create initial architecture plan',
          priority: 'high' as const
        },
        {
          type: 'implementation' as const,
          description: 'Set up project structure and development environment',
          priority: 'high' as const
        },
        {
          type: 'testing' as const,
          description: 'Establish testing framework and CI/CD pipeline',
          priority: 'medium' as const
        }
      ];

      // Assign setup tasks
      for (const task of setupTasks) {
        await this.teamManager.assignTask(sessionId, task);
      }

      this.logger.info(`Project ${projectName} started with session ${sessionId}`);
      return sessionId;

    } catch (error) {
      this.logger.error(`Failed to start project ${projectName}:`, error);
      throw error;
    }
  }

  async executeTaskRequest(sessionId: string, description: string, type: string = 'implementation'): Promise<string> {
    const task = {
      type: type as any,
      description,
      priority: 'medium' as const
    };

    return await this.teamManager.assignTask(sessionId, task);
  }

  async runCodeReview(sessionId: string, files?: string[]): Promise<string> {
    const task = {
      type: 'review' as const,
      description: `Perform comprehensive code review focusing on quality, security, and best practices`,
      priority: 'high' as const,
      files
    };

    return await this.teamManager.assignTask(sessionId, task);
  }

  async deployToStaging(sessionId: string): Promise<string> {
    const tasks = [
      {
        type: 'testing' as const,
        description: 'Run comprehensive test suite before deployment',
        priority: 'critical' as const
      },
      {
        type: 'deployment' as const,
        description: 'Deploy application to staging environment',
        priority: 'critical' as const
      }
    ];

    const results = await this.teamManager.executeParallelTasks(sessionId, tasks);
    return results.map(r => r.taskId).join(', ');
  }

  async getProjectStatus(sessionId: string): Promise<any> {
    return await this.teamManager.getSessionStatus(sessionId);
  }

  async endProject(sessionId: string): Promise<void> {
    await this.teamManager.endSession(sessionId);
  }

  // Demo methods for showcasing capabilities
  async runFullDevelopmentCycle(projectName: string): Promise<void> {
    try {
      this.logger.info(`Running full development cycle for: ${projectName}`);

      // 1. Start project
      const sessionId = await this.startNewProject(projectName);

      // 2. Initial analysis and planning
      await this.executeTaskRequest(
        sessionId,
        'Analyze requirements and create detailed technical specification',
        'analysis'
      );

      // 3. Parallel development tasks
      const developmentTasks = [
        {
          type: 'implementation' as const,
          description: 'Implement frontend user interface with React and TypeScript',
          priority: 'high' as const
        },
        {
          type: 'implementation' as const,
          description: 'Develop backend API with Node.js and Express',
          priority: 'high' as const
        },
        {
          type: 'implementation' as const,
          description: 'Set up database schema and migrations',
          priority: 'high' as const
        }
      ];

      await this.teamManager.executeParallelTasks(sessionId, developmentTasks);

      // 4. Quality assurance
      const qaTask = {
        type: 'testing' as const,
        description: 'Create comprehensive test suite and run quality checks',
        priority: 'high' as const
      };

      await this.teamManager.assignTask(sessionId, qaTask);

      // 5. Security review
      await this.runCodeReview(sessionId);

      // 6. Deployment
      await this.deployToStaging(sessionId);

      // 7. Get final status
      const finalStatus = await this.getProjectStatus(sessionId);
      this.logger.info('Project completed successfully:', finalStatus);

      // 8. End project
      await this.endProject(sessionId);

    } catch (error) {
      this.logger.error(`Development cycle failed for ${projectName}:`, error);
      throw error;
    }
  }

  async demonstrateTeamCapabilities(): Promise<void> {
    this.logger.info('Demonstrating Agentic Development Team capabilities...');

    // Show available tools
    const serverInfo = this.customToolsManager.getServerInfo();
    this.logger.info('Available custom tools:', serverInfo);

    // Run a sample development cycle
    await this.runFullDevelopmentCycle('DemoProject');

    this.logger.info('Demonstration completed successfully!');
  }
}

// CLI Interface
async function main() {
  const team = new AgenticDevTeam();

  try {
    await team.initialize();

    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'demo':
        await team.demonstrateTeamCapabilities();
        break;

      case 'start':
        const projectName = args[1] || 'NewProject';
        const sessionId = await team.startNewProject(projectName);
        console.log(`Started project ${projectName} with session ID: ${sessionId}`);
        break;

      case 'task':
        const taskSessionId = args[1];
        const taskDescription = args.slice(2).join(' ');
        if (!taskSessionId || !taskDescription) {
          console.error('Usage: npm run dev task <session-id> <task-description>');
          process.exit(1);
        }
        const taskId = await team.executeTaskRequest(taskSessionId, taskDescription);
        console.log(`Assigned task with ID: ${taskId}`);
        break;

      case 'status':
        const statusSessionId = args[1];
        if (!statusSessionId) {
          console.error('Usage: npm run dev status <session-id>');
          process.exit(1);
        }
        const status = await team.getProjectStatus(statusSessionId);
        console.log('Project status:', JSON.stringify(status, null, 2));
        break;

      case 'review':
        const reviewSessionId = args[1];
        if (!reviewSessionId) {
          console.error('Usage: npm run dev review <session-id>');
          process.exit(1);
        }
        const reviewId = await team.runCodeReview(reviewSessionId);
        console.log(`Started code review with ID: ${reviewId}`);
        break;

      case 'deploy':
        const deploySessionId = args[1];
        if (!deploySessionId) {
          console.error('Usage: npm run dev deploy <session-id>');
          process.exit(1);
        }
        const deployIds = await team.deployToStaging(deploySessionId);
        console.log(`Started deployment with IDs: ${deployIds}`);
        break;

      default:
        console.log(`
Agentic Development Team CLI

Usage:
  npm run dev demo                           - Run full capability demonstration
  npm run dev start [project-name]          - Start new project
  npm run dev task <session-id> <description> - Assign task to team
  npm run dev status <session-id>           - Get project status
  npm run dev review <session-id>           - Run code review
  npm run dev deploy <session-id>           - Deploy to staging

Examples:
  npm run dev demo
  npm run dev start "E-commerce Platform"
  npm run dev task session_123 "Implement user authentication"
  npm run dev review session_123
        `);
    }

  } catch (error: any) {
    console.error('Error:', error.message || 'Unknown error');
    process.exit(1);
  }
}

// Export for library use
export { TeamManager } from './core/TeamManager.js';
export { CustomToolsManager } from './tools/CustomToolsManager.js';
export { PermissionManager } from './security/PermissionManager.js';
export { HookManager } from './hooks/HookManager.js';
export { CostTracker } from './utils/CostTracker.js';
export { SessionManager } from './utils/SessionManager.js';
export * from './types/index.js';

// Run CLI if called directly
// Note: import.meta.url check doesn't work in all test environments
try {
  if (process.argv[1] && process.argv[1].endsWith('index.js')) {
    main().catch(console.error);
  }
} catch (error) {
  // Ignore import.meta errors in test environments
}