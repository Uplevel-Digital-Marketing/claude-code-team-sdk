import { PermissionManager } from '../../src/security/PermissionManager.js';

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;

  beforeEach(() => {
    const rules = {
      allow: [
        'Read(*)',
        'Write(./workspace/**)',
        'Bash(ls:*)',
        'Bash(git status)'
      ],
      deny: [
        'Write(.env)',
        'Bash(rm -rf /)',
        'Bash(sudo:*)'
      ],
      ask: [
        'Bash(git push:*)',
        'Write(./production/**)'
      ]
    };

    permissionManager = new PermissionManager(rules);
  });

  describe('evaluatePermission', () => {
    it('should allow explicitly allowed tools', async () => {
      const handler = permissionManager.getPermissionHandler();
      const result = await handler('Read', { file_path: '/any/file' }, {});

      expect(result.behavior).toBe('allow');
    });

    it('should deny explicitly denied tools', async () => {
      const handler = permissionManager.getPermissionHandler();
      const result = await handler('Write', { file_path: '.env' }, {});

      expect(result.behavior).toBe('deny');
      expect(result.message).toContain('denied');
    });

    it('should handle bash command patterns', async () => {
      const handler = permissionManager.getPermissionHandler();

      // Should allow ls commands
      const lsResult = await handler('Bash', { command: 'ls -la' }, {});
      expect(lsResult.behavior).toBe('allow');

      // Should deny dangerous rm commands
      const rmResult = await handler('Bash', { command: 'rm -rf /' }, {});
      expect(rmResult.behavior).toBe('deny');
    });

    it('should auto-approve ask rules in SDK context', async () => {
      const handler = permissionManager.getPermissionHandler();
      const result = await handler('Bash', { command: 'git push origin main' }, {});

      expect(result.behavior).toBe('allow');
      expect(result.message).toContain('would normally ask');
    });

    it('should apply default policy for unmatched tools', async () => {
      const handler = permissionManager.getPermissionHandler();

      // Safe tools should be allowed
      const grepResult = await handler('Grep', { pattern: 'test' }, {});
      expect(grepResult.behavior).toBe('allow');

      // Unknown tools should be denied
      const unknownResult = await handler('UnknownTool', {}, {});
      expect(unknownResult.behavior).toBe('deny');
    });

    it('should consider priority for bash commands', async () => {
      const handler = permissionManager.getPermissionHandler();
      const result = await handler(
        'Bash',
        { command: 'some-custom-command' },
        { priority: 'critical' }
      );

      expect(result.behavior).toBe('allow');
      expect(result.message).toContain('high priority');
    });
  });

  describe('rule matching', () => {
    it('should match file glob patterns', async () => {
      const handler = permissionManager.getPermissionHandler();

      // Should allow workspace files
      const workspaceResult = await handler('Write', { file_path: './workspace/test.js' }, {});
      expect(workspaceResult.behavior).toBe('allow');

      // Should deny system files
      const systemResult = await handler('Write', { file_path: '/etc/passwd' }, {});
      expect(systemResult.behavior).toBe('deny');
    });

    it('should match bash command prefixes', async () => {
      const handler = permissionManager.getPermissionHandler();

      // Should match ls with wildcard
      const lsResult = await handler('Bash', { command: 'ls -la /home' }, {});
      expect(lsResult.behavior).toBe('allow');

      // Should match exact git status
      const gitResult = await handler('Bash', { command: 'git status' }, {});
      expect(gitResult.behavior).toBe('allow');
    });
  });

  describe('audit logging', () => {
    it('should log permission decisions', async () => {
      const handler = permissionManager.getPermissionHandler();
      await handler('Read', { file_path: 'test.txt' }, {});

      const auditLog = permissionManager.getAuditLog();
      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].context.toolName).toBe('Read');
      expect(auditLog[0].result.behavior).toBe('allow');
    });

    it('should generate security reports', async () => {
      const handler = permissionManager.getPermissionHandler();

      // Generate some audit data
      await handler('Read', { file_path: 'safe.txt' }, {});
      await handler('Write', { file_path: '.env' }, {});
      await handler('Bash', { command: 'sudo rm -rf /' }, {});

      const report = permissionManager.generateSecurityReport();

      expect(report).toContain('Security Report');
      expect(report).toContain('Total Permission Requests: 3');
      expect(report).toContain('Allowed: 1');
      expect(report).toContain('Denied: 2');
    });
  });
});