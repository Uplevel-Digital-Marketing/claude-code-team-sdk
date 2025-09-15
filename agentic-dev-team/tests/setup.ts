import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.test') });

// Mock external dependencies
jest.mock('@anthropic/claude-code', () => ({
  query: jest.fn(),
  tool: jest.fn(),
  createSdkMcpServer: jest.fn()
}));

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.TEAM_WORKSPACE = path.join(process.cwd(), 'tests', 'fixtures', 'workspace');

// Increase test timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  createMockTeamConfig: () => ({
    name: 'TestTeam',
    workspace: '/test/workspace',
    members: [
      {
        id: 'test-architect',
        name: 'Test Architect',
        role: 'technical-lead',
        specialization: ['testing'],
        permissions: ['Read', 'Write'],
        systemPrompt: 'You are a test architect.'
      }
    ],
    mcpServers: {},
    permissionRules: {
      allow: ['Read(*)'],
      deny: ['Write(/etc/*)'],
      ask: ['Bash(rm:*)']
    },
    hooks: {
      PreToolUse: [],
      PostToolUse: [],
      UserPromptSubmit: [],
      SessionStart: [],
      SessionEnd: []
    },
    slashCommands: []
  }),

  createMockUsageData: () => ({
    input_tokens: 100,
    output_tokens: 200,
    cache_creation_input_tokens: 50,
    cache_read_input_tokens: 25,
    total_cost_usd: 0.015
  }),

  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};