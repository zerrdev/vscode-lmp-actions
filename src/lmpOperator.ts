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
    
    // Parse .gitignore files
    const gitignorePatterns = await this.parseGitignoreFiles(folderPath);
    
    const files = await this.getAllFiles(folderPath, {
      ...opts,
      gitignorePatterns
    });
    
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

  async copyFileAsLmp(filePath: string, relativeTo?: string): Promise<string> {
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const relPath = relativeTo ? 
        path.relative(relativeTo, filePath).replace(/\\/g, '/') : 
        path.basename(filePath);
        
      let lmpContent = `[FILE_START: ${relPath}]\n`;
      lmpContent += content;
      if (!content.endsWith('\n')) {
        lmpContent += '\n';
      }
      lmpContent += `[FILE_END: ${relPath}]\n\n`;
      return lmpContent;
    } catch (error) {
      throw new Error(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async parseGitignoreFiles(rootDir: string): Promise<string[]> {
    const gitignorePatterns: string[] = [];
    
    // Find all .gitignore files in the directory tree
    const gitignoreFiles = await this.findGitignoreFiles(rootDir);
    
    // Parse each .gitignore file
    for (const gitignoreFile of gitignoreFiles) {
      const gitignoreDir = path.dirname(gitignoreFile);
      const content = await fs.readFile(gitignoreFile, 'utf8');
      const patterns = this.parseGitignoreContent(content);
      
      // Add the patterns with their directory context
      for (const pattern of patterns) {
        // Convert pattern to absolute path relative to the gitignore location
        const absolutePattern = path.join(gitignoreDir, pattern).replace(/\\/g, '/');
        gitignorePatterns.push(absolutePattern);
      }
    }
    
    return gitignorePatterns;
  }
  
  private async findGitignoreFiles(dir: string): Promise<string[]> {
    const gitignoreFiles: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    // Check if there's a .gitignore in this directory
    const gitignorePath = path.join(dir, '.gitignore');
    if (await fs.pathExists(gitignorePath)) {
      gitignoreFiles.push(gitignorePath);
    }
    
    // Recursively check subdirectories
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules') {
        const subDirPath = path.join(dir, entry.name);
        const subDirGitignores = await this.findGitignoreFiles(subDirPath);
        gitignoreFiles.push(...subDirGitignores);
      }
    }
    
    return gitignoreFiles;
  }
  
  private parseGitignoreContent(content: string): string[] {
    const lines = content.split('\n');
    const patterns: string[] = [];
    
    for (let line of lines) {
      // Remove comments and trim
      line = line.replace(/#.*$/, '').trim();
      
      // Skip empty lines
      if (!line) {
        continue;
      }
      
      // Add the pattern
      patterns.push(line);
    }
    
    return patterns;
  }
  
  private isPathIgnoredByGitignore(filePath: string, gitignorePatterns: string[]): boolean {
    if (!gitignorePatterns.length) {
      return false;
    }
    
    // Convert Windows paths to forward slashes for consistency
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    for (const pattern of gitignorePatterns) {
      // Handle negation patterns (those starting with !)
      const isNegation = pattern.startsWith('!');
      const actualPattern = isNegation ? pattern.substring(1) : pattern;
      
      // Convert gitignore glob pattern to regex
      let regexPattern = this.globToRegExp(actualPattern);
      
      // Check if the path matches the pattern
      const matches = new RegExp(regexPattern).test(normalizedPath);
      
      if (matches) {
        // If it's a negation pattern and matches, the file should NOT be ignored
        if (isNegation) {
          return false;
        }
        // If it's a regular pattern and matches, the file should be ignored
        return true;
      }
    }
    
    return false;
  }
  
  private globToRegExp(pattern: string): string {
    // This is a simplified version - a real implementation would be more complex
    let regexPattern = pattern
      // Escape regex special chars except * and ?
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      // Convert * to .*
      .replace(/\*/g, '.*')
      // Convert ? to .
      .replace(/\?/g, '.');
    
    // Handle directory-specific patterns (ending with /)
    if (regexPattern.endsWith('/')) {
      regexPattern += '.*';
    }
    
    // Make it match the whole path
    return `^${regexPattern}$`;
  }

  private async getAllFiles(
    dir: string,
    options: {
      excludeExtensions: string[];
      excludePatterns: RegExp[];
      relativeTo: string;
      gitignorePatterns?: string[];
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
      
      // Check if the path matches any exclude pattern
      if (options.excludePatterns.some(pattern => pattern.test(relativePath))) {
        return [];
      }
      
      // Check if the path is ignored by gitignore
      if (options.gitignorePatterns && this.isPathIgnoredByGitignore(res, options.gitignorePatterns)) {
        return [];
      }
      
      return entry.isDirectory() ? this.getAllFiles(res, options) : [res];
    }));
    return files.flat();
  }
}
