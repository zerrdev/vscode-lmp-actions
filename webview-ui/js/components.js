const ConfigButtons = {
    view() {
        return [
            m('button', {
                onclick: () => vscodeService.openBaseConfig()
            }, 'Open config'),
            m('button', {
                onclick: () => vscodeService.openUserConfig()
            }, 'Open user config'),
            m('.top-actions', [
                m('button.copy-create-prompt-button', {
                    onclick: () => vscodeService.copyCreatePrompt()
                }, 'Copy Create Prompt')
            ]),
            m('.separator')
        ];
    }
};


const ExtractButton = {
    view() {
        return m('button.extract-button', {
            disabled: !appState.canExtract(),
            onclick: () => appState.extract()
        }, 'Extract Files');
    }
};


const FileTree = {
    selectedFile: null,
    expandedFolders: new Set(),

    renderTreeView(node, depth = 0) {
        const entries = Object.entries(node).sort((a, b) => {
            const aIsFolder = a[1].type === 'folder';
            const bIsFolder = b[1].type === 'folder';
            
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            return a[0].localeCompare(b[0]);
        });

        return entries.map(([key, value]) => {
            if (value.type === 'folder') {
                const folderId = `folder-${key}-${depth}`;
                const isExpanded = this.expandedFolders.has(folderId);
                
                return m('li', [
                    m('span.tree-caret', {
                        class: isExpanded ? 'tree-caret-down' : '',
                        onclick: () => {
                            if (isExpanded) {
                                this.expandedFolders.delete(folderId);
                            } else {
                                this.expandedFolders.add(folderId);
                            }
                        }
                    }),
                    m('span.tree-icon.tree-folder', '📁'),
                    value.name,
                    m('ul.nested', {
                        class: isExpanded ? 'active' : ''
                    }, this.renderTreeView(value.children, depth + 1))
                ]);
            } else {
                return m('li.file-item', {
                    'data-path': value.path,
                    class: this.selectedFile === value.path ? 'selected' : '',
                    onclick: () => {
                        this.selectedFile = value.path;
                        const content = appState.fileContents[value.path];
                        
                        if (content) {
                            vscodeService.previewFile(value.path, content);
                        }
                    }
                }, [
                    m('span.tree-icon.tree-file', '📄'),
                    value.name
                ]);
            }
        });
    },

    view() {
        const files = fileParser.findCompleteFileEntries(appState.textContent);
        const tree = fileParser.buildTreeStructure(files);
        const fileCount = files.length > 0 ? `(${files.length} files)` : '(No files)';

        return [
            m('label', [
                'LMP content: ',
                m('span.file-count', fileCount)
            ]),
            m('.file-tree', [
                appState.currentOutputDir && 
                m('.tree-root', [
                    m('span.tree-icon.tree-folder', '📁'),
                    appState.currentOutputDir
                ]),
                m('ul', 
                    files.length === 0 ? 
                    m('li', 'No files detected') :
                    this.renderTreeView(tree)
                )
            ])
        ];
    }
};


const Header = {
    view() {
        return m('h3', 'LMP Actions');
    }
};


const OutputDirectory = {
    view() {
        return [
            m('label', 'To:'),
            m('.directory-row', [
                m('input', {
                    type: 'text',
                    placeholder: 'Output directory...',
                    value: appState.outputDir,
                    oninput: (e) => {
                        appState.setOutputDir(e.target.value);
                        vscodeService.resolveOutputDir(e.target.value);
                    }
                }),
                m('button', {
                    onclick: () => vscodeService.selectDirectory()
                }, 'Browse')
            ]),
            m('label', 'Final path:'),
            m('div', [
                m('input', {
                    id: 'absoluteOutputDir',
                    readonly: true,
                    value: appState.absoluteOutputDir
                })
            ])
        ];
    }
};

const TextInput = {
    view() {
        return [
            m('label', { for: 'textContent' }, 'Paste file content:'),
            m('textarea', {
                id: 'textContent',
                placeholder: 'Paste your file content here...',
                value: appState.textContent,
                oninput: (e) => {
                    appState.setTextContent(e.target.value);
                }
            })
        ];
    }
};

