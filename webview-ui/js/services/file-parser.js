const fileParser = {
    findCompleteFileEntries(text) {
        const lines = text.split('\n');
        const files = [];
        let isReadingFile = false;
        let currentFilePath = '';
        let currentContent = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (!isReadingFile && line.match(/^\[FILE_START: .+\]$/)) {
                isReadingFile = true;
                currentFilePath = line.replace(/^\[FILE_START: (.+)\]$/, '$1').trim();
                currentContent = '';
            } else if (isReadingFile && line.match(/^\[FILE_END: .+\]$/)) {
                const foundFilePath = line.replace(/^\[FILE_END: (.+)\]$/, '$1').trim();
                if (currentFilePath === foundFilePath) {
                    files.push(currentFilePath);
                    appState.fileContents[currentFilePath] = currentContent;
                    isReadingFile = false;
                }
            } else if (isReadingFile) {
                currentContent += line + '\n';
            }
        }
        
        return files;
    },
    
    buildTreeStructure(files) {
        const tree = {};
        
        for (const file of files) {
            const parts = file.split('/');
            let current = tree;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    current[part] = { type: 'file', name: part, path: file };
                } else {
                    if (!current[part]) {
                        current[part] = { type: 'folder', name: part, children: {} };
                    }
                    current = current[part].children;
                }
            }
        }
        
        return tree;
    }
};
