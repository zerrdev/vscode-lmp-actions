import * as vscode from 'vscode';
import { LmpActionsViewProvider } from './lmpActionsViewProvider';
import path from 'path';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new LmpActionsViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'lmpActionsView',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lmpActions.extract', async () => {
      provider.extractFiles();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lmpActions.copyAsLMP', async (uri: vscode.Uri, uris: vscode.Uri[]) => {
      try {
        let lmpContent = '';
        
        // Case 1: Multiple items selected (uris parameter will be populated)
        if (uris && uris.length > 0) {
          for (const selectedUri of uris) {
            const stat = await vscode.workspace.fs.stat(selectedUri);
            if (stat.type === vscode.FileType.Directory) {
              lmpContent += await provider.folderAsLMP(selectedUri.fsPath);
            } else if (stat.type === vscode.FileType.File) {
              lmpContent += await provider.fileAsLMP(selectedUri.fsPath);
            }
          }
          await vscode.env.clipboard.writeText(lmpContent);
          vscode.window.showInformationMessage(`${uris.length} items copied as LMP format`);
          return;
        }
        
        // Case 2: Single item selected (uri parameter will be populated)
        if (uri) {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type === vscode.FileType.Directory) {
            lmpContent = await provider.folderAsLMP(uri.fsPath);
            await vscode.env.clipboard.writeText(lmpContent);
            vscode.window.showInformationMessage(`Folder "${path.basename(uri.fsPath)}" copied as LMP format`);
          } else if (stat.type === vscode.FileType.File) {
            lmpContent = await provider.fileAsLMP(uri.fsPath);
            await vscode.env.clipboard.writeText(lmpContent);
            vscode.window.showInformationMessage(`File "${path.basename(uri.fsPath)}" copied as LMP format`);
          }
          return;
        }
        
        // Case 3: No selection, copy entire workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          lmpContent = await provider.folderAsLMP(workspaceFolders[0].uri.fsPath);
          await vscode.env.clipboard.writeText(lmpContent);
          vscode.window.showInformationMessage(`Workspace "${workspaceFolders[0].name}" copied as LMP format`);
        } else {
          vscode.window.showWarningMessage('No workspace folder is open');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );
}

export function deactivate(): void {}
