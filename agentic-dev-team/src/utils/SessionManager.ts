import * as fs from 'fs-extra';
import * as path from 'path';
import { Logger } from './Logger.js';

export interface SessionMetadata {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  projectPath: string;
  transcriptPath: string;
  status: 'active' | 'completed' | 'interrupted';
  metadata: {
    model?: string;
    tools?: string[];
    lastMessageId?: string;
    totalCost?: number;
  };
}

export class SessionManager {
  private logger: Logger;
  private sessionsPath: string;

  constructor() {
    this.logger = new Logger('SessionManager');
    this.sessionsPath = path.join(process.env.HOME || '~', '.config', 'claude', 'sessions');
  }

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createWorkspace(workspacePath: string): Promise<void> {
    await this.ensureDirectory(workspacePath);
    await this.ensureDirectory(path.join(workspacePath, 'reports'));
    await this.ensureDirectory(path.join(workspacePath, 'logs'));
    await this.ensureDirectory(path.join(workspacePath, 'temp'));

    this.logger.info(`Created workspace at ${workspacePath}`);
  }

  async ensureDirectory(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async saveSessionMetadata(metadata: SessionMetadata): Promise<void> {
    const metadataPath = path.join(this.sessionsPath, 'sessions.json');

    let sessions: SessionMetadata[] = [];
    if (await this.fileExists(metadataPath)) {
      const content = await this.readFile(metadataPath);
      sessions = JSON.parse(content);
    }

    // Update or add session
    const existingIndex = sessions.findIndex(s => s.id === metadata.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = metadata;
    } else {
      sessions.push(metadata);
    }

    await this.writeFile(metadataPath, JSON.stringify(sessions, null, 2));
  }

  async getSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    const metadataPath = path.join(this.sessionsPath, 'sessions.json');

    if (!(await this.fileExists(metadataPath))) {
      return null;
    }

    const content = await this.readFile(metadataPath);
    const sessions: SessionMetadata[] = JSON.parse(content);

    return sessions.find(s => s.id === sessionId) || null;
  }

  async listSessions(): Promise<SessionMetadata[]> {
    const metadataPath = path.join(this.sessionsPath, 'sessions.json');

    if (!(await this.fileExists(metadataPath))) {
      return [];
    }

    const content = await this.readFile(metadataPath);
    return JSON.parse(content);
  }

  async resumeSession(sessionId: string): Promise<SessionMetadata | null> {
    const metadata = await this.getSessionMetadata(sessionId);

    if (!metadata) {
      this.logger.warn(`Session ${sessionId} not found`);
      return null;
    }

    if (metadata.status === 'completed') {
      this.logger.warn(`Session ${sessionId} is already completed`);
      return null;
    }

    // Update status to active
    metadata.status = 'active';
    metadata.updatedAt = new Date();
    await this.saveSessionMetadata(metadata);

    this.logger.info(`Resumed session ${sessionId}`);
    return metadata;
  }

  async completeSession(sessionId: string): Promise<void> {
    const metadata = await this.getSessionMetadata(sessionId);

    if (!metadata) {
      this.logger.warn(`Session ${sessionId} not found`);
      return;
    }

    metadata.status = 'completed';
    metadata.updatedAt = new Date();
    await this.saveSessionMetadata(metadata);

    this.logger.info(`Completed session ${sessionId}`);
  }

  async archiveOldSessions(daysOld: number = 30): Promise<void> {
    const sessions = await this.listSessions();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const toArchive = sessions.filter(s =>
      s.status === 'completed' &&
      new Date(s.updatedAt) < cutoffDate
    );

    for (const session of toArchive) {
      // Move transcript to archive
      const archivePath = path.join(this.sessionsPath, 'archive');
      await this.ensureDirectory(archivePath);

      if (await this.fileExists(session.transcriptPath)) {
        const archiveTranscriptPath = path.join(archivePath, `${session.id}.jsonl`);
        await fs.move(session.transcriptPath, archiveTranscriptPath);
      }
    }

    // Remove from active sessions
    const activeSessions = sessions.filter(s =>
      !toArchive.some(archived => archived.id === s.id)
    );

    const metadataPath = path.join(this.sessionsPath, 'sessions.json');
    await this.writeFile(metadataPath, JSON.stringify(activeSessions, null, 2));

    this.logger.info(`Archived ${toArchive.length} old sessions`);
  }

  async getSessionStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    interrupted: number;
    totalCost: number;
  }> {
    const sessions = await this.listSessions();

    return {
      total: sessions.length,
      active: sessions.filter(s => s.status === 'active').length,
      completed: sessions.filter(s => s.status === 'completed').length,
      interrupted: sessions.filter(s => s.status === 'interrupted').length,
      totalCost: sessions.reduce((sum, s) => sum + (s.metadata.totalCost || 0), 0)
    };
  }
}