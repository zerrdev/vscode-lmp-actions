import * as vscode from 'vscode';
import { LmpActionsViewProvider } from './lmpActionsViewProvider';
import path from 'path';
import { copyDefaultConfig } from './utils';
import { instructionFactory } from './instructionFactory';

export function activate(context: vscode.ExtensionContext): void {
  copyDefaultConfig(context);
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
          // Find common parent directory for all selected items
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

          for (const selectedUri of uris) {
            const stat = await vscode.workspace.fs.stat(selectedUri);
            if (stat.type === vscode.FileType.Directory) {
              lmpContent += await provider.folderAsLMP(selectedUri.fsPath, { relativeTo: workspaceRoot });
            } else if (stat.type === vscode.FileType.File) {
              lmpContent += await provider.fileAsLMP(selectedUri.fsPath, workspaceRoot);
            }
          }
          await vscode.env.clipboard.writeText(lmpContent);
          vscode.window.showInformationMessage(`${uris.length} items copied as LMP format`);
          return;
        }

        // Case 2: Single item selected (uri parameter will be populated)
        if (uri) {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type === vscode.FileType.Directory) {
            lmpContent = await provider.folderAsLMP(uri.fsPath, { relativeTo: workspaceRoot });
            await vscode.env.clipboard.writeText(lmpContent);
            vscode.window.showInformationMessage(`Folder "${path.basename(uri.fsPath)}" copied as LMP format`);
          } else if (stat.type === vscode.FileType.File) {
            lmpContent = await provider.fileAsLMP(uri.fsPath, workspaceRoot);
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

  context.subscriptions.push(
    vscode.commands.registerCommand('lmpActions.copyAsLMPWithInstructions', async (uri: vscode.Uri, uris: vscode.Uri[]) => {
      try {
        const instructionPrompt = await vscode.window.showInputBox({
          ignoreFocusOut: true,
          prompt: 'Enter your instruction for this LMP file',
          placeHolder: 'e.g., Add a login feature to this React app'
        });

        if (instructionPrompt === undefined) {
          // User cancelled the input
          return;
        }

        let lmpContent = '';
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        // Case 1: Multiple items selected (uris parameter will be populated)
        if (uris && uris.length > 0) {
          for (const selectedUri of uris) {
            const stat = await vscode.workspace.fs.stat(selectedUri);
            if (stat.type === vscode.FileType.Directory) {
              lmpContent += await provider.folderAsLMP(selectedUri.fsPath, { relativeTo: workspaceRoot });
            } else if (stat.type === vscode.FileType.File) {
              lmpContent += await provider.fileAsLMP(selectedUri.fsPath, workspaceRoot);
            }
          }

          const formattedContent = instructionFactory.newEditInstruction(context, lmpContent, instructionPrompt);
          await vscode.env.clipboard.writeText(formattedContent);
          vscode.window.showInformationMessage(`${uris.length} items copied as LMP format with instructions`);
          return;
        }

        // Case 2: Single item selected (uri parameter will be populated)
        if (uri) {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type === vscode.FileType.Directory) {
            lmpContent = await provider.folderAsLMP(uri.fsPath, { relativeTo: workspaceRoot });
            const formattedContent = instructionFactory.newEditInstruction(context, lmpContent, instructionPrompt);
            await vscode.env.clipboard.writeText(formattedContent);
            vscode.window.showInformationMessage(`Folder "${path.basename(uri.fsPath)}" copied as LMP format with instructions`);
          } else if (stat.type === vscode.FileType.File) {
            lmpContent = await provider.fileAsLMP(uri.fsPath, workspaceRoot);
            const formattedContent = instructionFactory.newEditInstruction(context, lmpContent, instructionPrompt);
            await vscode.env.clipboard.writeText(formattedContent);
            vscode.window.showInformationMessage(`File "${path.basename(uri.fsPath)}" copied as LMP format with instructions`);
          }
          return;
        }

        // Case 3: No selection, copy entire workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
          lmpContent = await provider.folderAsLMP(workspaceFolders[0].uri.fsPath);
          const formattedContent = instructionFactory.newEditInstruction(context, lmpContent, instructionPrompt);
          await vscode.env.clipboard.writeText(formattedContent);
          vscode.window.showInformationMessage(`Workspace "${workspaceFolders[0].name}" copied as LMP format with instructions`);
        } else {
          vscode.window.showWarningMessage('No workspace folder is open');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );
}