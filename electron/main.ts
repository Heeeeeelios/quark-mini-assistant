import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { readDirectory } from './services/file-reader';
import { AIService, ApiError } from './services/ai-service';
import { getApiKey as getKeyFromStore, saveApiKey, removeApiKey } from './config/key-store';

// __dirname is available in CommonJS (output of tsc)
const ELECTRON_ROOT = __dirname;

let mainWindow: BrowserWindow | null = null;
let aiService: AIService | null = null;

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

  // Populate AI service file cache
  aiService?.setFileCache(dirResult.nodes);

  return { nodes: dirResult.nodes, truncated: dirResult.truncated };
});

ipcMain.handle('get-file-meta', async (_event, _fileId: string): Promise<unknown> => {
  // TODO: T4 — get file metadata (already loaded in file-reader, just need to return it)
  return null;
});

ipcMain.handle('analyze-file', async (_event, fileId: string): Promise<unknown> => {
  console.log('[analyze-file] Request for fileId:', fileId);
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
    const result = await aiService.analyzeFile(fileId);
    console.log('[analyze-file] AI service result:', result.source);
    return result;
  } catch (err) {
    console.error('[analyze-file] AI service error:', err);
    if (err instanceof ApiError) {
      return { error: { code: err.code, message: err.message } };
    }
    return { error: { code: 'UNKNOWN', message: '未知错误' } };
  }
});

ipcMain.handle('chat-completion', async (_event, params: { messages: Array<{ role: string; content: string }>; fileId: string; fileSummary: string }): Promise<void> => {
  if (!aiService) {
    // No API key — send mock response via event
    mainWindow?.webContents.send('chat-chunk', '当前未配置 API Key，已切换至演示模式。');
    mainWindow?.webContents.send('chat-done');
    return;
  }

  try {
    for await (const chunk of aiService.chatStream(params.messages, params.fileId, params.fileSummary)) {
      mainWindow?.webContents.send('chat-chunk', chunk);
    }
    mainWindow?.webContents.send('chat-done');
  } catch (err) {
    const errorMsg = err instanceof ApiError ? err.message : '对话失败';
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
