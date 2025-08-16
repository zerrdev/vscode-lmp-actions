import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import os from 'os';
import { LmpOperator } from './lmpOperator';
import { getDefaultConfigPath, getUserConfigPath, readConfig } from './utils';
import { instructionFactory } from './instructionFactory';

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

    const mainCssUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'styles', 'main.css')
    );
    const mithrilUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'js', 'mithril.js')
    );
    const componentsUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'js', 'components.js')
    );
    const vscodeServiceUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'js', 'services', 'vscode.js')
    );
    const fileParserServiceUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'js', 'services', 'file-parser.js')
    );
    const appUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview-ui', 'js', 'app.js')
    );

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, {
      appUri,
      mainCssUri,
      componentsUri,
      mithrilUri,
      vscodeServiceUri,
      fileParserServiceUri
    });

    // Initialize with default workspace path
    const defaultOutputDir = this.getDefaultWorkspacePath();
    if (defaultOutputDir) {
      webviewView.webview.postMessage({
        type: 'initializeOutputDir',
        directory: defaultOutputDir
      });
    }   

    webviewView.webview.onDidReceiveMessage(async (data: any) => {
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
        case 'previewFile': {
          // Handle file preview request
          if (data.filePath && data.content) {
            await this.showFilePreview(data.filePath, data.content);
          }
          break;
        }
        case 'copyCreatePrompt': {
          await this.copyCreatePrompt(data.userPrompt);
          break;
        }
        case 'openBaseConfig': {
          // Handle copy create prompt request
          await this.openConfigFile('base');
          break;
        }
        case 'openUserConfig': {
          await this.openConfigFile('user');
          break;
        }
      }
    });
  }

  private async openConfigFile(type: 'user' | 'base') {
    let uri;
    let opts: vscode.TextDocumentShowOptions = {preview: false};
    let readonly = false;

    if (type == 'base') {
      uri = vscode.Uri.file(getDefaultConfigPath(this.context));
      readonly = true;
    }

    if (type == 'user') {
      uri = vscode.Uri.file(getUserConfigPath(this.context));
    }

    if (!uri) {
      return;
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, opts);
    if (readonly) {
      await vscode.commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
    }
  }

  public async copyCreatePrompt(userPrompt: string): Promise<void> {
    try {
      if (userPrompt === undefined) {
        // User cancelled the input
        return;
      }

      const fullPrompt = instructionFactory.newCreateInstruction(this.context, userPrompt)

      await vscode.env.clipboard.writeText(fullPrompt);
      vscode.window.showInformationMessage('Create prompt copied to clipboard');
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async showFilePreview(filePath: string, content: string): Promise<void> {
    // Create a temporary file in the system's temp directory
    const tempFile = path.join(os.tmpdir(), `lmp-preview-${path.basename(filePath)}`);
    await fs.promises.writeFile(tempFile, content, 'utf8');
    
    // Check if a file with the same path exists in the workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const workspaceFilePath = path.join(workspaceRoot, filePath);
      
      if (await this.fileExists(workspaceFilePath)) {
        // If file exists in workspace, open a diff view
        const workspaceFileUri = vscode.Uri.file(workspaceFilePath);
        const tempFileUri = vscode.Uri.file(tempFile);
        
        await vscode.commands.executeCommand('vscode.diff', 
          workspaceFileUri, 
          tempFileUri, 
          `${path.basename(filePath)} (Workspace ↔ Preview)`
        );
        return;
      }
    }
    
    // If no matching file in workspace, just open the preview
    const document = await vscode.workspace.openTextDocument(tempFile);
    await vscode.window.showTextDocument(document, { preview: true });
    
    // Set the document language based on file extension
    const extension = path.extname(filePath).substring(1);
    if (extension) {
      vscode.languages.setTextDocumentLanguage(document, extension);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
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

  public async folderAsLMP(uri: string, options: { relativeTo?: string } = {}): Promise<string> {
    const config = readConfig(this.context);
    const configExcludePatterns: string[] = config.lmpActions.excludePatterns || [];
    const configExcludeExtensions: string[] = config.lmpActions.excludeExtensions || [];
    const patternRegexps = configExcludePatterns.map(pattern => new RegExp(pattern));
    return await this.lmpOperator.copyFolderAsLmp(uri, {
      excludeExtensions: configExcludeExtensions,
      excludePatterns: patternRegexps,
      relativeTo: options.relativeTo || uri
    });
  }

  public async fileAsLMP(uri: string, relativeTo?: string): Promise<string> {
    return await this.lmpOperator.copyFileAsLmp(uri, relativeTo);
  }

  private _getHtmlForWebview(webview: vscode.Webview, uriMap: object): string {
    const extensionPath = this.context.extensionPath;
    const htmlPath = vscode.Uri.file(path.join(extensionPath, 'webview-ui', 'index.html'));
    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
    for (let uriPlaceholder of Object.keys(uriMap)) {
      htmlContent = htmlContent.replace("${" + uriPlaceholder + "}", (uriMap as any)[uriPlaceholder] as string ?? '');
    }

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