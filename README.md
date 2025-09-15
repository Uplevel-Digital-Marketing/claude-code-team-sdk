# Claude Code Team SDK

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Build Status](https://img.shields.io/github/workflow/status/uplevel-digital-marketing/claude-code-team-sdk/CI)](https://github.com/uplevel-digital-marketing/claude-code-team-sdk/actions)

> A comprehensive Claude Code SDK implementation featuring an AI-powered development team that demonstrates every SDK capability for building production-ready agentic systems.

## 🚀 Overview

The Claude Code Team SDK is a complete reference implementation showcasing the full capabilities of Anthropic's Claude Code TypeScript SDK. This project demonstrates how to build sophisticated AI agent teams that can replace traditional development departments through advanced automation, intelligent task management, and seamless workflow integration.

### Key Features

- 🤖 **Complete AI Development Team** - 6 specialized AI agents with distinct roles
- 🛠️ **20+ Custom Tools** - Comprehensive MCP tool servers for development workflows
- 🔒 **Advanced Security** - Multi-layer permission system with granular controls
- 📊 **Cost Tracking** - Real-time usage monitoring and optimization
- 🔄 **Session Management** - Persistent conversations with resume capabilities
- 🎯 **Hook System** - Event-driven workflow automation
- 🧪 **Comprehensive Testing** - Unit, integration, and E2E test coverage
- 🚀 **Production Ready** - Docker, Kubernetes, and CI/CD pipelines included

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [AI Team Members](#ai-team-members)
- [SDK Features Demonstrated](#sdk-features-demonstrated)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Testing](#testing)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- TypeScript 5.3+
- Anthropic API key
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/uplevel-digital-marketing/claude-code-team-sdk.git
cd claude-code-team-sdk

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Add your Anthropic API key
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
```

## 🤖 AI Team Members

Our AI development team consists of 6 specialized agents, each with unique capabilities:

| Role | Specialization | Key Capabilities |
|------|---------------|------------------|
| **Senior Software Architect** | Technical Leadership | Architecture design, code reviews, technical decisions |
| **Frontend Specialist** | React/TypeScript | UI/UX implementation, modern web technologies |
| **Backend Specialist** | Node.js/APIs | Server-side architecture, database design, API development |
| **DevOps Engineer** | Infrastructure | CI/CD, containerization, cloud deployment, monitoring |
| **Security Specialist** | Security & Compliance | Vulnerability assessment, security audits, compliance checks |
| **QA Engineer** | Quality Assurance | Test automation, quality metrics, bug detection |

## 🛠️ SDK Features Demonstrated

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

## 🏗️ Architecture

```
claude-code-team-sdk/
├── agentic-dev-team/           # Main implementation
│   ├── src/
│   │   ├── core/
│   │   │   └── TeamManager.ts  # Main orchestration logic
│   │   ├── config/
│   │   │   └── team-config.ts  # Team member definitions
│   │   ├── security/
│   │   │   └── PermissionManager.ts
│   │   ├── hooks/
│   │   │   └── HookManager.ts  # Event hooks
│   │   ├── tools/
│   │   │   └── CustomToolsManager.ts
│   │   └── utils/
│   │       ├── CostTracker.ts
│   │       ├── SessionManager.ts
│   │       └── Logger.ts
│   ├── workspace/
│   │   ├── .claude/            # Claude Code configuration
│   │   │   ├── agents/         # Subagent definitions
│   │   │   ├── commands/       # Slash commands
│   │   │   └── settings.json   # Permission rules
│   │   └── CLAUDE.md          # Project memory
│   └── tests/                 # Comprehensive test suite
├── guides/                    # Documentation
│   └── MCP_SDK.md            # MCP integration guide
├── OVERVIEW.md               # SDK overview
└── TYPESCRIPT_SDK_CLAUDE.md  # API reference
```

## 📚 Usage Examples

### Programmatic API

```typescript
import { AgenticDevTeam } from './agentic-dev-team/src/index.js';

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

## ⚙️ Configuration

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

Modify `agentic-dev-team/src/config/team-config.ts` to:
- Add new team members with different specializations
- Configure permission rules for your security requirements
- Add custom slash commands for your workflows
- Customize system prompts for different behavior

## 🧪 Testing

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

## 🚀 Deployment

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
kubectl apply -f agentic-dev-team/kubernetes/deployment.yaml

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

## 💰 Cost Management

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

## 🔒 Security Features

- **Multi-layer permission system** with granular controls
- **Security audit hooks** blocking dangerous operations
- **Encrypted configuration** for sensitive data
- **Audit logging** of all tool usage
- **Role-based access** by team member specialization

## 📊 Performance Features

- **Parallel task execution** for faster development cycles
- **Prompt caching** to reduce API costs
- **Session resumption** for interrupted workflows
- **Context compaction** for long conversations
- **Streaming responses** for real-time feedback

## 📖 API Reference

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

## 🤝 Contributing

This project serves as a reference implementation. To extend it:

1. **Add new team members** in `team-config.ts`
2. **Create custom tools** in `tools/CustomToolsManager.ts`
3. **Implement new hooks** in `hooks/HookManager.ts`
4. **Add slash commands** in the `.claude/commands/` directory
5. **Write tests** for all new functionality

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions about:
- **Claude Code SDK**: See the [official documentation](https://docs.anthropic.com/en/docs/claude-code)
- **This implementation**: Check the comprehensive tests and inline documentation
- **Bug reports**: Use the GitHub Issues in this repository

## 🔗 Related Resources

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Model Context Protocol (MCP)](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [Custom Tools Guide](https://docs.anthropic.com/en/docs/claude-code/sdk/custom-tools)
- [TypeScript SDK Reference](https://docs.anthropic.com/en/docs/claude-code/sdk/sdk-typescript)

---

**Built with ❤️ using the Claude Code TypeScript SDK**

This implementation demonstrates the complete capabilities of the Claude Code TypeScript SDK for building production-ready agentic systems that can replace traditional human development teams.