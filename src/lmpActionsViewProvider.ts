import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LmpOperator } from './lmpOperator';

export class LmpActionsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'lmpActionsView';
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly context: vscode.ExtensionContext;
  private readonly lmpOperator: LmpOperator;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.lmpOperator = new LmpOperator();
    this._extensionUri = context.extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Initialize with default workspace path
    const defaultOutputDir = this.getDefaultWorkspacePath();
    if (defaultOutputDir) {
      webviewView.webview.postMessage({
        type: 'initializeOutputDir',
        directory: defaultOutputDir
      });
    }

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case 'extract':
          if (data.textContent && data.outputDir) {
            try {
              await this.extractFilesImplementation(data.textContent, data.outputDir);
              vscode.window.showInformationMessage(`Files extracted to ${data.outputDir}`);
              // Update the tree view after extraction
              webviewView.webview.postMessage({
                type: 'updateFileTree',
                content: data.textContent,
                outputDir: data.outputDir
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              vscode.window.showErrorMessage(`Error extracting files: ${errorMessage}`);
            }
          } else {
            vscode.window.showErrorMessage('Please provide text content and output directory');
          }
          break;
        case 'selectDirectory':
          try {
            const folders = await vscode.window.showOpenDialog({
              canSelectFiles: false,
              canSelectFolders: true,
              canSelectMany: false,
              openLabel: 'Select Output Directory'
            });
            if (folders && folders.length > 0) {
              webviewView.webview.postMessage({
                type: 'directorySelected',
                directory: folders[0].fsPath
              });
            }
          } catch { /* empty */ }
          break;
        case 'showError':
          await vscode.window.showErrorMessage(data.message);
          break;
        case 'resolveOutputDir': {
          const parsedPath = this.parsePath(data.outputDir);
          webviewView.webview.postMessage({
            type: 'resolvedOutputDir',
            directory: parsedPath
          });
          break;
        }
        case 'refreshTree': {
          // Handle tree refresh requests
          webviewView.webview.postMessage({
            type: 'updateFileTree',
            content: data.content,
            outputDir: data.outputDir
          });
          break;
        }
      }
    });
  }

  private getDefaultWorkspacePath(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }
    return workspaceFolders[0].uri.fsPath;
  }

  private parsePath(inputPath: string): string | null {
    const normalizedPath = inputPath.replace(/[/\\]/g, path.sep);
    if (path.isAbsolute(normalizedPath)) {
      return normalizedPath;
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }
    const workspacePath = workspaceFolders[0].uri.fsPath;
    return path.join(workspacePath, normalizedPath);
  }

  public async extractFiles(): Promise<void> {
    if (!this._view) {
      vscode.window.showErrorMessage('LMP actions view is not available');
      return;
    }
    this._view.webview.postMessage({ type: 'requestExtract' });
  }

  public async folderAsLMP(uri: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('lmpActions');
    const configExcludePatterns = config.get<string[]>('excludePatterns') || [];
    const configExcludeExtensions = config.get<string[]>('excludeExtensions') || [];
    const patternRegexps = configExcludePatterns.map(pattern => new RegExp(pattern));
    return await this.lmpOperator.copyFolderAsLmp(uri, {
      excludeExtensions: configExcludeExtensions,
      excludePatterns: patternRegexps
    });
  }

  public async fileAsLMP(uri: string): Promise<string> {
    return await this.lmpOperator.copyFileAsLmp(uri);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const extensionPath = this.context.extensionPath;
    const htmlPath = vscode.Uri.file(path.join(extensionPath, 'webview-ui', 'lmp-actions.html'));
    const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
    return htmlContent.replace(/\$\{webview\.cspSource\}/g, webview.cspSource);
  }

  private async extractFilesImplementation(textContent: string, outputDir: string): Promise<void> {
    await this.doExtractFiles(textContent, outputDir);
  }

  private async doExtractFiles(textContent: string, toDirectory: string): Promise<void> {
    const parsedDirectory = this.parsePath(toDirectory);
    if (!parsedDirectory) {
      return;
    }
    await this.lmpOperator.extract({ content: textContent }, parsedDirectory);
  }
}
