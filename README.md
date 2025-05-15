# LMP Actions

LMP Actions is a VSCode extension that provides tools for handling Lumped (LMP) files, allowing you to extract content from LMP format and create LMP files from your workspace.

## Features

### Extract Files
Extract files from LMP format into your workspace. The extension provides a dedicated view where you can:
- Paste LMP content
- Preview files before extraction
- Select an output directory
- Extract all files with a single click

### Copy as LMP
Convert files or folders to LMP format with these commands:
- **Copy as LMP**: Right-click on a file or folder in the Explorer to copy its contents in LMP format
- **Copy as LMP - Edit instruction**: Same as above, but allows you to add custom instructions for editing

### LMP Format
The LMP format uses a simple structure:
```
[FILE_START: path/to/file.ext]
file contents
[FILE_END: path/to/file.ext]
```


## Getting Started

1. Install the extension from the VSCode Marketplace
2. Access the LMP Actions view from the Activity Bar
3. Use the context menu in the Explorer to copy files as LMP
4. Paste LMP content into the view to extract files

## Extension Settings

This extension provides the following settings:

* `lmpActions.excludePatterns`: Folder patterns to exclude when copying as LMP
* `lmpActions.excludeExtensions`: File extensions to exclude when copying as LMP
* `lmpActions.editInstruction`: Custom instruction for editing LMP files

## Commands

* `lmpActions.extract`: Extract files from LMP content
* `lmpActions.copyAsLMP`: Copy selected files/folders as LMP
* `lmpActions.copyAsLMPWithInstructions`: Copy as LMP with custom edit instructions

## Usage Examples

### Extracting Files
1. Open the LMP Actions view
2. Paste LMP content into the text area
3. Select an output directory
4. Click "Extract Files"

### Creating LMP Files
1. Right-click on a file or folder in the Explorer
2. Select "Copy as LMP"
3. Paste the LMP content wherever needed

## Notes

- The extension respects `.gitignore` files when copying as LMP
- Binary files and large assets are excluded by default
- You can customize which files to exclude in the settings

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
