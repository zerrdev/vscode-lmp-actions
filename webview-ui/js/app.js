const appState = {
    textContent: '',
    outputDir: '',
    absoluteOutputDir: '',
    currentOutputDir: '',
    fileContents: {},

    setTextContent(content) {
        this.textContent = content;
        this.updateFileTree();
    },

    setOutputDir(dir) {
        this.outputDir = dir;
    },

    setOutputDirectory(directory) {
        this.outputDir = directory;
        this.absoluteOutputDir = directory;
        this.currentOutputDir = directory;
    },

    setResolvedOutputDirectory(directory) {
        if (!directory) {
            this.absoluteOutputDir = '';
        } else {
            this.absoluteOutputDir = directory;
            this.currentOutputDir = directory;
        }
    },

    updateFileTree() {
        this.fileContents = {};
    },

    canExtract() {
        return this.textContent && this.absoluteOutputDir;
    },

    extract() {
        if (!this.textContent) {
            vscodeService.showError("Please enter some text content");
            return;
        }

        if (!this.outputDir) {
            vscodeService.showError("Please select an output directory");
            return;
        }

        vscodeService.extract(this.textContent, this.outputDir);
    }
};

const App = {
    oninit() {
        vscodeService.init();
    },

    view() {
        return m('.container', [
            m(Header),
            m(ConfigButtons),
            m(TextInput),
            m(FileTree),
            m(OutputDirectory),
            m(ExtractButton)
        ]);
    }
};

m.mount(document.getElementById('app'), App);
