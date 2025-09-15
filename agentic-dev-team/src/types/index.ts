export interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialization: string[];
  permissions: string[];
  systemPrompt: string;
  outputStyle?: string;
}

export interface TeamConfiguration {
  name: string;
  workspace: string;
  members: TeamMember[];
  mcpServers: Record<string, any>;
  permissionRules: PermissionRules;
  hooks: HookConfiguration;
  slashCommands: SlashCommand[];
}

export interface PermissionRules {
  allow: string[];
  deny: string[];
  ask: string[];
}

export interface HookConfiguration {
  PreToolUse: HookMatcher[];
  PostToolUse: HookMatcher[];
  UserPromptSubmit: HookMatcher[];
  SessionStart: HookMatcher[];
  SessionEnd: HookMatcher[];
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookCallback[];
}

export interface HookCallback {
  name: string;
  handler: Function;
}

export interface SlashCommand {
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools?: string[];
  model?: string;
}

export interface TaskRequest {
  type: 'analysis' | 'implementation' | 'review' | 'testing' | 'deployment' | 'debugging';
  description: string;
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  files?: string[];
  dependencies?: string[];
}

export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'in_progress';
  result?: string;
  artifacts?: string[];
  usage?: any;
  cost?: number;
  duration?: number;
}

export interface TeamSession {
  id: string;
  name: string;
  startTime: Date;
  workspace: string;
  activeMembers: string[];
  currentTasks: TaskRequest[];
  completedTasks: TaskResult[];
  totalCost: number;
  totalUsage: any;
}