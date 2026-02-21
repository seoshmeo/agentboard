import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { projects } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { readdir, stat, readFile } from 'node:fs/promises';
import { resolve, relative, join, extname } from 'node:path';

// Directories and patterns to skip
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', '.cache',
  '.turbo', '.vercel', '.output', '__pycache__', '.pytest_cache',
  'coverage', '.nyc_output', '.parcel-cache', 'vendor', '.svn',
  '.hg', '.DS_Store', 'thumbs.db',
]);

const IGNORED_EXTENSIONS = new Set([
  '.pyc', '.pyo', '.class', '.o', '.obj', '.exe', '.dll', '.so',
  '.dylib', '.lock', '.sqlite', '.db', '.sqlite3',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.md', '.mdx', '.txt', '.csv', '.xml', '.html', '.htm',
  '.css', '.scss', '.less', '.sass', '.styl',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.sql', '.graphql', '.gql', '.prisma',
  '.env', '.env.example', '.env.local',
  '.gitignore', '.dockerignore', '.eslintrc', '.prettierrc',
  '.editorconfig', '.nvmrc',
  '', // files without extension (Makefile, Dockerfile, etc.)
]);

const MAX_FILE_SIZE = 512 * 1024; // 512KB max for reading
const MAX_DEPTH = 6;

function shouldIgnore(name: string): boolean {
  if (name.startsWith('.') && name !== '.env' && name !== '.env.example' && name !== '.env.local'
    && name !== '.gitignore' && name !== '.dockerignore' && name !== '.editorconfig'
    && name !== '.eslintrc' && name !== '.prettierrc' && name !== '.nvmrc'
    && name !== '.agentboard') {
    return true;
  }
  return IGNORED_DIRS.has(name);
}

function isTextFile(name: string): boolean {
  const ext = extname(name).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Files without extension
  if (!ext) {
    const basenames = ['Makefile', 'Dockerfile', 'Procfile', 'Gemfile', 'Rakefile', 'LICENSE', 'README', 'CHANGELOG', 'CLAUDE'];
    return basenames.some(b => name.startsWith(b));
  }
  return false;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
}

async function buildTree(dirPath: string, basePath: string, depth: number = 0): Promise<FileNode[]> {
  if (depth > MAX_DEPTH) return [];

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;
    if (IGNORED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue;

    const fullPath = join(dirPath, entry.name);
    const relPath = relative(basePath, fullPath);

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, basePath, depth + 1);
      nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
    } else if (entry.isFile()) {
      try {
        const fileStat = await stat(fullPath);
        nodes.push({ name: entry.name, path: relPath, type: 'file', size: fileStat.size });
      } catch {
        nodes.push({ name: entry.name, path: relPath, type: 'file' });
      }
    }
  }

  return nodes;
}

function safePath(basePath: string, requestedPath: string): string | null {
  const resolved = resolve(basePath, requestedPath);
  if (!resolved.startsWith(resolve(basePath))) return null; // path traversal
  return resolved;
}

export async function fileRoutes(app: FastifyInstance) {
  // List files (tree)
  app.get('/api/projects/:id/files', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.projectId !== id) return reply.status(403).send({ error: 'Access denied' });

    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project?.localPath) return reply.status(400).send({ error: 'Project has no local path configured' });

    const query = request.query as { path?: string };
    const targetDir = query.path
      ? safePath(project.localPath, query.path)
      : project.localPath;

    if (!targetDir) return reply.status(400).send({ error: 'Invalid path' });

    try {
      const tree = await buildTree(targetDir, project.localPath);
      return { root: project.localPath, tree };
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to read directory' });
    }
  });

  // Read file content
  app.get('/api/projects/:id/files/content', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.projectId !== id) return reply.status(403).send({ error: 'Access denied' });

    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project?.localPath) return reply.status(400).send({ error: 'Project has no local path configured' });

    const query = request.query as { path: string };
    if (!query.path) return reply.status(400).send({ error: 'path query parameter is required' });

    const filePath = safePath(project.localPath, query.path);
    if (!filePath) return reply.status(400).send({ error: 'Invalid path' });

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) return reply.status(400).send({ error: 'Not a file' });
      if (fileStat.size > MAX_FILE_SIZE) return reply.status(400).send({ error: 'File too large (max 512KB)' });

      if (!isTextFile(query.path.split('/').pop() || '')) {
        return reply.status(400).send({ error: 'Binary file — not readable' });
      }

      const content = await readFile(filePath, 'utf-8');
      const ext = extname(filePath).toLowerCase().slice(1) || 'text';

      return { path: query.path, content, language: ext, size: fileStat.size };
    } catch (err: any) {
      if (err.code === 'ENOENT') return reply.status(404).send({ error: 'File not found' });
      return reply.status(500).send({ error: 'Failed to read file' });
    }
  });
}
