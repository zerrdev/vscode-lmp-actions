import * as vscode from 'vscode';
import { LmpActionsViewProvider } from './lmpActionsViewProvider';

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
    vscode.commands.registerCommand('lmpActions.copyAsLMP', async (uri: vscode.Uri) => {
      if (uri) {
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type === vscode.FileType.Directory) {
            const lmpContent = await provider.folderAsLMP(uri.fsPath);
            await vscode.env.clipboard.writeText(lmpContent);
            vscode.window.showInformationMessage(`Folder "${uri.fsPath}" copied as LMP format`);
          } else if (stat.type === vscode.FileType.File) {
            const lmpContent = await provider.fileAsLMP(uri.fsPath);
            await vscode.env.clipboard.writeText(lmpContent);
            vscode.window.showInformationMessage(`File "${uri.fsPath}" copied as LMP format`);
          } else {
            vscode.window.showWarningMessage('This command only works on files and folders');
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('lmpActions.copyMultipleAsLMP', async (uris: vscode.Uri[]) => {
      if (uris && uris.length > 0) {
        try {
          let lmpContent = '';
          for (const uri of uris) {
            const stat = await vscode.workspace.fs.stat(uri);
            if (stat.type === vscode.FileType.Directory) {
              lmpContent += await provider.folderAsLMP(uri.fsPath);
            } else if (stat.type === vscode.FileType.File) {
              lmpContent += await provider.fileAsLMP(uri.fsPath);
            }
          }
          await vscode.env.clipboard.writeText(lmpContent);
          vscode.window.showInformationMessage(`${uris.length} items copied as LMP format`);
        } catch (error) {
          vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    })
  );
}

export function deactivate(): void {}
