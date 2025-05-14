import * as fs from 'fs-extra';
import * as path from 'path';
import { createInterface } from 'readline';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

export class LmpOperator {
  async extract(from: { content: string, filePath?: string } | { filePath: string, content?: string }, destDir: string): Promise<number> {
    if (from.filePath) {
      if (!await fs.pathExists(from.filePath)) {
        throw new Error(`Input file does not exist: ${from.filePath}`);
      }
    }
    await fs.ensureDir(destDir);
    let fileStream;
    if (from.filePath) {
      fileStream = createReadStream(from.filePath, { encoding: 'utf8' });
    } else {
      fileStream = Readable.from(from.content!);
    }
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    let isReadingFile = false;
    let currentFilePath = '';
    let currentFileContent = '';
    let extractedFileCount = 0;
    for await (const line of rl) {
      if (!isReadingFile && line.match(/^\[FILE_START: .+\]$/)) {
        isReadingFile = true;
        currentFilePath = line.replace(/^\[FILE_START: (.+)\]$/, '$1').trim();
        currentFileContent = '';
        continue;
      }
      if (isReadingFile && line.match(/^\[FILE_END: .+\]$/)) {
        const foundFilePath = line.replace(/^\[FILE_END: (.+)\]$/, '$1').trim();
        if (currentFilePath === foundFilePath) {
          const fullPath = path.join(destDir, currentFilePath);
          await this.writeFile(fullPath, currentFileContent);
          isReadingFile = false;
          extractedFileCount++;
          continue;
        }
      }
      if (isReadingFile) {
        currentFileContent += line + '\n';
      }
    }
    if (isReadingFile) {
      throw new Error(`Unclosed file declaration: ${currentFilePath}`);
    }
    return extractedFileCount;
  }

  private async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.ensureDir(dir);
    await fs.writeFile(filePath, content);
  }

  async copyFolderAsLmp(
    folderPath: string,
    options: {
      excludeExtensions?: string[];
      excludePatterns?: RegExp[];
      relativeTo?: string;
    } = {}
  ): Promise<string> {
    const opts = {
      excludeExtensions: options.excludeExtensions || [],
      excludePatterns: options.excludePatterns || [],
      relativeTo: options.relativeTo || folderPath
    };
    if (!await fs.pathExists(folderPath)) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }
    const files = await this.getAllFiles(folderPath, opts);
    let lmpContent = '';
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const relativePath = path.relative(opts.relativeTo, file).replace(/\\/g, '/');
        lmpContent += `[FILE_START: ${relativePath}]\n`;
        lmpContent += content;
        if (!content.endsWith('\n')) {
          lmpContent += '\n';
        }
        lmpContent += `[FILE_END: ${relativePath}]\n\n`;
      } catch { /* empty */ }
    }
    return lmpContent;
  }

  async copyFileAsLmp(filePath: string): Promise<string> {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const fileName = path.basename(filePath);
      let lmpContent = `[FILE_START: ${fileName}]\n`;
      lmpContent += content;
      if (!content.endsWith('\n')) {
        lmpContent += '\n';
      }
      lmpContent += `[FILE_END: ${fileName}]\n\n`;
      return lmpContent;
    } catch (error) {
      throw new Error(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getAllFiles(
    dir: string,
    options: {
      excludeExtensions: string[];
      excludePatterns: RegExp[];
      relativeTo: string;
    }
  ): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const res = path.resolve(dir, entry.name);
      const ext = path.extname(entry.name).toLowerCase();
      if (options.excludeExtensions.includes(ext)) {
        return [];
      }
      const relativePath = path.relative(options.relativeTo, res).replace(/\\/g, '/');
      if (options.excludePatterns.some(pattern => pattern.test(relativePath))) {
        return [];
      }
      return entry.isDirectory() ? this.getAllFiles(res, options) : [res];
    }));
    return files.flat();
  }
}
