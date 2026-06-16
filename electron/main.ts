import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { readDirectory } from './services/file-reader';
import type { FileNode } from './services/file-reader';
import { AIService, ApiError } from './services/ai-service';
import { getApiKey as getKeyFromStore, saveApiKey, removeApiKey } from './config/key-store';

// __dirname is available in CommonJS (output of tsc)
const ELECTRON_ROOT = __dirname;

let mainWindow: BrowserWindow | null = null;
let aiService: AIService | null = null;

// Persist loaded directory nodes so we can re-populate cache when AI service is recreated
let currentNodes: FileNode[] = [];

const MAX_CONTENT_LINES = 200;
const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.log', '.json', '.csv', '.yaml', '.yml', '.toml',
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.java', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
  '.c', '.cpp', '.h', '.cs', '.dart', '.lua', '.pl',
  '.xml', '.html', '.css', '.scss', '.less',
  '.sh', '.bash', '.zsh', '.fish', '.ps1',
  '.ini', '.cfg', '.conf', '.env', '.properties',
  '.sql', '.graphql', '.proto', '.thrift',
  '.svg', '.rst', '.adoc', '.markdown',
]);

/**
 * Read file content from disk for AI analysis.
 * Returns null for binary files or read errors.
 */
function readFileContentForAnalysis(fileId: string): { content: string | null; ext: string } {
  const ext = path.extname(fileId).toLowerCase();

  if (!TEXT_EXTENSIONS.has(ext)) {
    return { content: null, ext };
  }

  try {
    const raw = fs.readFileSync(fileId, 'utf-8');
    const lines = raw.split('\n');
    if (lines.length > MAX_CONTENT_LINES) {
      return {
        content: lines.slice(0, MAX_CONTENT_LINES).join('\n'),
        ext,
      };
    }
    return { content: raw, ext };
  } catch {
    return { content: null, ext };
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(ELECTRON_ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(ELECTRON_ROOT, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize the AI service on app ready.
 * Uses getApiKey() which checks userData/config.json first, then .env.
 */
function initAIService(): void {
  const apiKey = getKeyFromStore();
  if (apiKey) {
    aiService = new AIService(apiKey);
    // Re-populate cache if directory was loaded before AI service init
    if (currentNodes.length > 0) {
      aiService.setFileCache(currentNodes);
    }
  }
}

/**
 * Re-populate the AI service file cache with current directory nodes.
 */
function refreshFileCache(): void {
  if (aiService && currentNodes.length > 0) {
    aiService.setFileCache(currentNodes);
    console.log(`[refreshFileCache] Re-populated cache with ${currentNodes.length} root nodes`);
  }
}

app.whenReady().then(() => {
  initAIService();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ---- IPC handlers ----

ipcMain.handle('check-api-key', async (): Promise<{ configured: boolean }> => {
  return { configured: getKeyFromStore() !== null };
});

ipcMain.handle('save-api-key', async (_event, key: string): Promise<{ success: boolean }> => {
  const success = saveApiKey(key);
  if (success) {
    // Re-initialize AI service with new key
    const newKey = getKeyFromStore();
    if (newKey) {
      aiService = new AIService(newKey);
      // Re-populate file cache with previously loaded directory
      refreshFileCache();
    }
  }
  return { success };
});

ipcMain.handle('remove-api-key', async (): Promise<void> => {
  removeApiKey();
  aiService = null;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择文件夹',
    properties: ['openDirectory'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  const dirResult = await readDirectory(selectedPath);

  // Persist nodes for later cache re-population
  currentNodes = dirResult.nodes;

  // Populate AI service file cache
  aiService?.setFileCache(dirResult.nodes);

  return { nodes: dirResult.nodes, truncated: dirResult.truncated };
});

ipcMain.handle('get-file-meta', async (_event, _fileId: string): Promise<unknown> => {
  // TODO: T4 — get file metadata (already loaded in file-reader, just need to return it)
  return null;
});

ipcMain.handle('analyze-file', async (_event, fileId: string): Promise<unknown> => {
  console.log('[analyze-file] Request received, fileId:', fileId);

  // Read file content directly from disk — doesn't depend on fileCache
  const { content, ext } = readFileContentForAnalysis(fileId);
  console.log(`[analyze-file] Disk read: ext=${ext}, contentLength=${content?.length ?? 'null'}`);

  if (!aiService) {
    // No API key — return mock result
    console.log('[analyze-file] No API key configured, returning mock result');
    return {
      summary: '当前未配置 API Key，已切换至演示模式。此为 Mock 分析结果。',
      keyPoints: ['配置 DASHSCOPE_API_KEY 环境变量后可获得真实 AI 分析结果'],
      analysisTimeMs: 0,
      source: 'mock',
    };
  }

  try {
    // Pass content directly — no dependency on fileCache
    const result = await aiService.analyzeFileWithContent(fileId, ext, content);
    console.log('[analyze-file] AI service result:', result.source);
    return result;
  } catch (err) {
    console.error('[analyze-file] AI service error:', err);
    let errorMsg = '分析失败';
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'AUTH_FAILED':
          errorMsg = 'API Key 验证失败，请在设置中检查 Key 是否正确';
          break;
        case 'RATE_LIMIT':
          errorMsg = '请求频率过高或额度已用完，请稍后再试';
          break;
        case 'TIMEOUT':
          errorMsg = '请求超时，可能是文件过大或网络不稳定';
          break;
        case 'NETWORK_ERROR':
          errorMsg = '网络连接失败，请检查网络后重试';
          break;
        default:
          errorMsg = `分析失败：${err.message}`;
      }
    }
    return { error: { code: 'ANALYSIS_FAILED', message: errorMsg } };
  }
});

ipcMain.handle('chat-completion', async (_event, params: { messages: Array<{ role: string; content: string }>; fileId: string; fileSummary: string }): Promise<void> => {
  if (!aiService) {
    // No API key — send mock response via event
    mainWindow?.webContents.send('chat-chunk', '当前未配置 API Key，已切换至演示模式。此为 Mock 结果。');
    mainWindow?.webContents.send('chat-done');
    return;
  }

  try {
    for await (const chunk of aiService.chatStream(params.messages, params.fileId, params.fileSummary)) {
      mainWindow?.webContents.send('chat-chunk', chunk);
    }
    mainWindow?.webContents.send('chat-done');
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const rawStack = err instanceof Error ? err.stack : '';
    console.error('[chat-completion] Raw error:', rawMessage);
    console.error('[chat-completion] Stack:', rawStack);

    // Use raw error message by default — user sees it directly in the UI
    let errorMsg = rawMessage;
    if (err instanceof ApiError) {
      switch (err.code) {
        case 'AUTH_FAILED':
          errorMsg = 'API Key 验证失败，请在设置中检查 Key 是否正确';
          break;
        case 'RATE_LIMIT':
          errorMsg = '请求频率过高或额度已用完，请稍后再试';
          break;
        case 'TIMEOUT':
          errorMsg = '请求超时，可能是文件过大或网络不稳定';
          break;
        case 'NETWORK_ERROR':
          errorMsg = '网络连接失败，请检查网络后重试';
          break;
      }
    }
    mainWindow?.webContents.send('chat-done', errorMsg);
  }
});

// ---- Window control ----

ipcMain.handle('window-minimize', (): void => {
  mainWindow?.minimize();
});

ipcMain.handle('window-close', (): void => {
  mainWindow?.close();
});
