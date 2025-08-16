const Header = {
    view() {
        return m('h3', 'LMP Actions');
    }
};

const TabNavigation = {
    view() {
        return m('.tab-navigation', [
            m('button.tab', {
                class: appState.activeTab === 'create' ? 'active' : '',
                onclick: () => appState.setActiveTab('create')
            }, 'Create'),
            m('button.tab', {
                class: appState.activeTab === 'edit' ? 'active' : '',
                onclick: () => appState.setActiveTab('edit')
            }, 'Edit'),
            m('button.tab', {
                class: appState.activeTab === 'config' ? 'active' : '',
                onclick: () => appState.setActiveTab('config')
            }, 'Config')
        ]);
    }
};

const TabContent = {
    view() {
        switch (appState.activeTab) {
            case 'create':
                return m(CreateTab);
            case 'edit':
                return m(EditTab);
            case 'config':
                return m(ConfigTab);
            default:
                return m(CreateTab);
        }
    }
};

const CreateTab = {
    view() {
        return m('.tab-content', [
            m('label', { for: 'userPrompt' }, 'Enter your prompt:'),
            m('textarea', {
                id: 'userPrompt',
                placeholder: 'Describe what you want to create...',
                value: appState.userPrompt,
                oninput: (e) => {
                    appState.setUserPrompt(e.target.value);
                }
            }),
            m('.top-actions', [
                m('button', {
                    onclick: () => vscodeService.copyCreatePrompt(appState.userPrompt)
                }, 'Copy creation prompt')
            ])
        ]);
    }
};

const EditTab = {
    view() {
        return m('.tab-content', [
            m(TextInput),
            m(FileTree),
            m(OutputDirectory),
            m(ExtractButton)
        ]);
    }
};

const ConfigTab = {
    view() {
        return m('.tab-content', [
            m(ConfigButtons)
        ]);
    }
};

const ConfigButtons = {
    view() {
        return [
            m('button', {
                onclick: () => vscodeService.openBaseConfig()
            }, 'Open config'),
            m('button', {
                onclick: () => vscodeService.openUserConfig()
            }, 'Open user config')
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


