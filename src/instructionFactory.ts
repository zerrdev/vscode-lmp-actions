import * as vscode from 'vscode';
import path from 'path';
import * as fs from 'fs-extra';
import { readConfig } from "./utils";

function newInstruction(context: vscode.ExtensionContext, rulesKey: string, promptStructureKey: string, userPrompt: string, lmpContent?: string): string {
  const config: any = readConfig(context);

  const promptBase: string = config.lmpActions[promptStructureKey];
  const rules: string = config.lmpActions[rulesKey];

  let standardInstructions: string = promptBase;
  standardInstructions = standardInstructions.replace('#RULES#', rules);
  standardInstructions = standardInstructions.replace('#USER_PROMPT#', userPrompt);
  if (lmpContent !== undefined) {
      standardInstructions = standardInstructions.replace('#FILES#', `\`\`\`\n${lmpContent}\n\`\`\``);
  }

  return `${standardInstructions}`;
}

function newEditInstruction(context: vscode.ExtensionContext, lmpContent: string, userPrompt: string): string {
  return newInstruction(context, 'editRules', 'editPromptStructure', userPrompt, lmpContent);
}

function newCreateInstruction(context: vscode.ExtensionContext, userPrompt: string): string {
  return newInstruction(context, 'createRules', 'createPromptStructure', userPrompt, undefined);
}

export const instructionFactory = {
    newEditInstruction,
    newCreateInstruction
}