import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import path from 'path';
import { read } from 'fs';

export function getUserConfigPath(context: vscode.ExtensionContext): string {
  const userConfigDir = context.globalStorageUri.fsPath;
  return path.join(userConfigDir, 'lmp-actions-config.yml');
}

export function getDefaultConfigPath(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, 'config.default.yml');
}

export function copyDefaultConfig(context: vscode.ExtensionContext): void {
  const defaultConfigPath = getDefaultConfigPath(context);
  const userConfigDir = context.globalStorageUri.fsPath;
  const userConfigPath = getUserConfigPath(context);

  if (!fs.existsSync(userConfigPath)) {
    fs.mkdirSync(userConfigDir, { recursive: true });
    fs.copyFileSync(defaultConfigPath, userConfigPath);
    return;
  }
}

function readYml(path: string): any {
  try {
    const fileContent = fs.readFileSync(path, 'utf8');
    return yaml.load(fileContent);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to read LMP actions base config: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  } 
}

export function readConfig(context: vscode.ExtensionContext): any {
  let config = readYml(getDefaultConfigPath(context));
  const userConfigPath = getUserConfigPath(context);

  if (fs.existsSync(userConfigPath)) {
    const userConfig = readYml(userConfigPath);
    config = {...config, ...userConfig}
  }

  return config;
}