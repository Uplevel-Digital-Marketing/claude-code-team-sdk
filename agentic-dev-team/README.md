# Agentic Development Team

> A comprehensive demonstration of the Claude Code TypeScript SDK implementing a complete AI-powered development team

## Overview

This project showcases **every feature** of the Claude Code TypeScript SDK by implementing a sophisticated agentic development team that can completely replace human development departments. The system demonstrates all SDK capabilities including streaming input, custom tools, permission management, hooks, subagents, session management, cost tracking, and more.

## Features Implemented

### ✅ Complete SDK Feature Coverage

1. **Streaming Input Mode** - Interactive, multi-turn conversations with queued messages
2. **Custom MCP Tools** - 20+ specialized development tools across 5 tool servers
3. **Permission Management** - Granular security controls with allow/deny/ask rules
4. **Hook System** - Event-driven workflow automation with 6 different hook types
5. **Subagents** - 6 specialized AI team members with distinct roles and capabilities
6. **Slash Commands** - 6 custom commands for team coordination and specialized operations
7. **Session Management** - Persistent conversation state with resume capabilities
8. **Cost Tracking** - Comprehensive usage monitoring and billing calculation
9. **Output Styles** - 3 customized response formatting styles
10. **Todo Management** - Structured task tracking with real-time progress updates

### 🤖 AI Team Members

- **Senior Software Architect** - Technical leadership and architectural guidance
- **Frontend Development Specialist** - React, TypeScript, and modern web technologies
- **Backend Development Specialist** - Node.js, APIs, and server-side architecture
- **DevOps Engineer** - Infrastructure, deployment, and operational excellence
- **Security Specialist** - Security audits, vulnerability assessment, and compliance
- **Quality Assurance Engineer** - Test strategy, automation, and quality metrics

### 🛠 Custom Tool Servers

1. **dev-workflow** - Code analysis, testing, and deployment automation
2. **api-integrations** - GitHub, Slack, and JIRA integrations
3. **database-tools** - Safe database operations and migrations
4. **monitoring** - Application metrics and alerting
5. **team-coordination** - Task assignment and meeting scheduling

## Quick Start

### Prerequisites

- Node.js 18+
- Anthropic API key
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/anthropics/claude-code-sdk
cd claude-code-sdk/agentic-dev-team

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Add your Anthropic API key to .env
echo "ANTHROPIC_API_KEY=your_api_key_here" >> .env

# Build the project
npm run build
```

### Basic Usage

```bash
# Run the full capability demonstration
npm run dev demo

# Start a new project
npm run dev start "My New Project"

# Assign a task to the team
npm run dev task session_123 "Implement user authentication with JWT"

# Run a security audit
npm run dev review session_123

# Deploy to staging
npm run dev deploy session_123

# Check project status
npm run dev status session_123
```

## SDK Features Demonstrated

### 1. Streaming Input Mode

```typescript
async function* generateMessages() {
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "Analyze this codebase for security issues"
    }
  };

  // Can queue additional messages, handle interruptions, etc.
}

for await (const message of query({
  prompt: generateMessages(),
  options: { maxTurns: 10 }
})) {
  // Process streaming responses
}
```

### 2. Custom MCP Tools

```typescript
const customServer = createSdkMcpServer({
  name: "dev-workflow",
  version: "1.0.0",
  tools: [
    tool(
      "analyze_codebase",
      "Analyze codebase structure and generate insights",
      {
        path: z.string(),
        type: z.enum(["structure", "quality", "security"]),
        depth: z.number().optional().default(3)
      },
      async (args) => {
        // Implementation
      }
    )
  ]
});
```

### 3. Permission Management

```typescript
const permissionRules = {
  allow: [
    "Read(*)",
    "Write(./workspace/**)",
    "Bash(git:*)"
  ],
  deny: [
    "Write(.env)",
    "Bash(rm -rf /)",
    "Bash(sudo:*)"
  ],
  ask: [
    "Bash(git push:*)",
    "Write(./production/**)"
  ]
};
```

### 4. Hook System

```typescript
const hooks = {
  PreToolUse: [{
    hooks: [async (input, toolUseId, { signal }) => {
      if (input.tool_name === 'Bash' && input.tool_input.command.includes('rm -rf')) {
        return {
          decision: 'block',
          reason: 'Dangerous command blocked'
        };
      }
      return { continue: true };
    }]
  }]
};
```

### 5. Session Management

```typescript
// Start session
const sessionId = await teamManager.startTeamSession("Project Alpha");

// Resume session
const session = await sessionManager.resumeSession(sessionId);

// Session persistence with automatic file-based storage
```

### 6. Cost Tracking

```typescript
const costTracker = new CostTracker();

// Process messages and track costs
costTracker.processMessage(message);

// Generate detailed cost reports
const report = costTracker.generateReport();
console.log(`Total cost: $${costTracker.getTotalCost()}`);
```

## Architecture

```
agentic-dev-team/
├── src/
│   ├── core/
│   │   └── TeamManager.ts           # Main orchestration logic
│   ├── config/
│   │   └── team-config.ts           # Team member definitions
│   ├── security/
│   │   └── PermissionManager.ts     # Permission handling
│   ├── hooks/
│   │   └── HookManager.ts           # Event hooks
│   ├── tools/
│   │   └── CustomToolsManager.ts    # MCP tool servers
│   ├── utils/
│   │   ├── CostTracker.ts           # Usage tracking
│   │   ├── SessionManager.ts        # Session persistence
│   │   └── Logger.ts                # Logging system
│   └── types/
│       └── index.ts                 # TypeScript definitions
├── workspace/
│   ├── .claude/
│   │   ├── agents/                  # Subagent definitions
│   │   ├── commands/                # Slash commands
│   │   ├── output-styles/           # Response styles
│   │   └── settings.json            # Permission rules
│   └── CLAUDE.md                    # Project memory
├── tests/
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── e2e/                         # End-to-end tests
├── kubernetes/                      # K8s deployment
├── .github/workflows/               # CI/CD pipeline
└── docker-compose.yml               # Local deployment
```

## API Usage Examples

### Programmatic API

```typescript
import { AgenticDevTeam } from './src/index.js';

const team = new AgenticDevTeam();
await team.initialize();

// Start a new project
const sessionId = await team.startNewProject("E-commerce Platform");

// Execute tasks
await team.executeTaskRequest(sessionId, "Implement user authentication", "implementation");
await team.runCodeReview(sessionId);
await team.deployToStaging(sessionId);

// Get status
const status = await team.getProjectStatus(sessionId);
console.log(`Project cost: $${status.totalCost}`);
```

### CLI Interface

```bash
# Available commands
npm run dev demo                    # Full demonstration
npm run dev start [project-name]   # Start new project
npm run dev task <id> <description> # Assign task
npm run dev review <session-id>    # Code review
npm run dev deploy <session-id>    # Deploy to staging
npm run dev status <session-id>    # Project status
```

## Testing

Comprehensive test suite covering all SDK features:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

### Test Coverage

- **Unit Tests**: Individual components and utilities
- **Integration Tests**: TeamManager with real file system operations
- **E2E Tests**: Complete workflows from project start to deployment
- **Mock Strategy**: Claude Code SDK mocked for predictable testing

## Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Includes:
# - Main application
# - Redis for caching
# - PostgreSQL for data storage
# - Prometheus + Grafana for monitoring
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f kubernetes/deployment.yaml

# Features:
# - Multi-replica deployment
# - Persistent volumes for workspace and logs
# - Health checks and resource limits
# - Secret management for API keys
```

### CI/CD Pipeline

GitHub Actions workflow includes:
- Automated testing and quality checks
- Security scanning with Snyk
- Docker image building and publishing
- Automated deployment to staging/production
- Slack notifications

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your_api_key_here

# Optional
TEAM_WORKSPACE=/path/to/workspace
LOG_LEVEL=info
CLAUDE_CODE_USE_BEDROCK=1  # Use Amazon Bedrock
CLAUDE_CODE_USE_VERTEX=1   # Use Google Vertex AI

# External integrations
GITHUB_TOKEN=your_github_token
SLACK_TOKEN=your_slack_token
JIRA_API_TOKEN=your_jira_token
```

### Team Customization

Modify `src/config/team-config.ts` to:
- Add new team members with different specializations
- Configure permission rules for your security requirements
- Add custom slash commands for your workflows
- Customize system prompts for different behavior

## Cost Management

The system includes comprehensive cost tracking:

- **Real-time tracking** of token usage and costs
- **Per-task breakdown** with detailed metrics
- **Session-level aggregation** for project budgeting
- **Cost optimization** through efficient prompt caching

Example cost report:
```
Total Input Tokens: 15,000
Total Output Tokens: 25,000
Cache Read Tokens: 5,000
Total Cost: $0.45
Average Cost per Task: $0.12
```

## Performance Features

- **Parallel task execution** for faster development cycles
- **Prompt caching** to reduce API costs
- **Session resumption** for interrupted workflows
- **Context compaction** for long conversations
- **Streaming responses** for real-time feedback

## Security Features

- **Multi-layer permission system** with granular controls
- **Security audit hooks** blocking dangerous operations
- **Encrypted configuration** for sensitive data
- **Audit logging** of all tool usage
- **Role-based access** by team member specialization

## Monitoring and Observability

- **Structured logging** with Winston
- **Metrics collection** via custom hooks
- **Performance tracking** for all operations
- **Error reporting** with detailed stack traces
- **Session analytics** for usage patterns

## Contributing

This project serves as a reference implementation. To extend it:

1. **Add new team members** in `team-config.ts`
2. **Create custom tools** in `tools/CustomToolsManager.ts`
3. **Implement new hooks** in `hooks/HookManager.ts`
4. **Add slash commands** in the `.claude/commands/` directory
5. **Write tests** for all new functionality

## SDK Features Reference

| Feature | Implementation | File Location |
|---------|---------------|---------------|
| Streaming Input | `generateMessages()` generators | `core/TeamManager.ts` |
| Custom Tools | MCP server creation | `tools/CustomToolsManager.ts` |
| Permissions | Rule-based system | `security/PermissionManager.ts` |
| Hooks | Event-driven callbacks | `hooks/HookManager.ts` |
| Subagents | File-based configuration | `workspace/.claude/agents/` |
| Slash Commands | Markdown definitions | `workspace/.claude/commands/` |
| Session Management | File persistence | `utils/SessionManager.ts` |
| Cost Tracking | Usage analytics | `utils/CostTracker.ts` |
| Output Styles | Response formatting | `workspace/.claude/output-styles/` |
| Todo Management | Task tracking | Built into SDK |

## License

This project is provided as a reference implementation for the Claude Code TypeScript SDK. See the main Claude Code repository for licensing terms.

## Support

For questions about:
- **Claude Code SDK**: See the [official documentation](https://docs.anthropic.com/en/docs/claude-code)
- **This implementation**: Check the comprehensive tests and inline documentation
- **Bug reports**: Use the GitHub Issues in the main Claude Code repository

---

This implementation demonstrates the complete capabilities of the Claude Code TypeScript SDK for building production-ready agentic systems that can replace traditional human development teams.