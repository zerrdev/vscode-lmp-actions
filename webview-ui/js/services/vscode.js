const vscodeService = {
    vscode: null,
    
    init() {
        this.vscode = acquireVsCodeApi();
        window.addEventListener('message', this.handleMessage.bind(this));
    },
    
    postMessage(data) {
        this.vscode.postMessage(data);
    },
    
    handleMessage(event) {
        const message = event.data;
        
        switch (message.type) {
            case 'directorySelected':
                appState.setOutputDirectory(message.directory);
                break;
            case 'resolvedOutputDir':
                appState.setResolvedOutputDirectory(message.directory);
                break;
            case 'requestExtract':
                appState.extract();
                break;
            case 'updateFileTree':
                if (message.content) {
                    if (message.outputDir) {
                        appState.setOutputDirectory(message.outputDir);
                    }
                    appState.setTextContent(message.content);
                } else {
                    appState.updateFileTree();
                }
                break;
            case 'initializeOutputDir':
                if (message.directory) {
                    appState.setOutputDirectory(message.directory);
                }
                break;
        }
        
        m.redraw();
    },
    
    selectDirectory() {
        this.postMessage({ command: 'selectDirectory' });
    },
    
    copyCreatePrompt(userPrompt) {
        this.postMessage({ command: 'copyCreatePrompt', userPrompt });
    },
    
    openBaseConfig() {
        this.postMessage({ command: 'openBaseConfig' });
    },
    
    openUserConfig() {
        this.postMessage({ command: 'openUserConfig' });
    },
    
    extract(textContent, outputDir) {
        this.postMessage({
            command: 'extract',
            textContent: textContent,
            outputDir: outputDir
        });
    },
    
    resolveOutputDir(outputDir) {
        this.postMessage({
            command: 'resolveOutputDir',
            outputDir: outputDir
        });
    },
    
    showError(message) {
        this.postMessage({
            command: 'showError',
            message: message
        });
    },
    
    previewFile(filePath, content) {
        this.postMessage({
            command: 'previewFile',
            filePath: filePath,
            content: content
        });
    }
};
