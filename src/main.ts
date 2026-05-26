import './style.css';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { gcodeFDMLanguage, gcodeCNCLanguage } from '@duet3d/monacotokens';
import { attachGcodeLinter } from './gcode-linter';
import { registerDuetProviders } from '@duet3d/monacotokens/dist/providers';
import { installStaticObjectModelContext } from './objectmodel-context';

// Monaco Editor のワーカー設定
self.MonacoEnvironment = {
  getWorker(_moduleId: string, _label: string) {
    return new editorWorker();
  },
};

// ---------------------------------------------------------------------------
// Language registration
// ---------------------------------------------------------------------------
monaco.languages.register({ id: 'gcode-fdm' });
monaco.languages.setMonarchTokensProvider('gcode-fdm', gcodeFDMLanguage as monaco.languages.IMonarchLanguage);

monaco.languages.register({ id: 'gcode-cnc' });
monaco.languages.setMonarchTokensProvider('gcode-cnc', gcodeCNCLanguage as monaco.languages.IMonarchLanguage);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
type GcodeMode = 'gcode-fdm' | 'gcode-cnc';

let currentFilename = 'untitled.gcode';
let isDarkTheme = true;
let currentMode: GcodeMode = 'gcode-fdm';
let isModified = false;

const SAMPLE_GCODE = `; RRF Web Editor サンプル Gコード
; RepRapFirmware 向け FDM プリント

M83           ; 相対押出モード
G28           ; ホーム
G29           ; オートレベリング
M190 S60      ; ベッド温度 60°C 待機
M109 S200     ; ノズル温度 200°C 待機
G92 E0        ; 押出量リセット

; プリント開始
G1 Z0.3 F3000
G1 X10 Y10 F5000
G1 X200 Y10 E15 F2000
G1 X200 Y200 E15
G1 X10 Y200 E15
G1 X10 Y10 E15

G92 E0
G1 Z10 F3000
M104 S0       ; ノズル冷却
M140 S0       ; ベッド冷却
M84           ; モーター停止
`;

// ---------------------------------------------------------------------------
// Editor creation
// ---------------------------------------------------------------------------
const editorContainer = document.getElementById('editor-container')!;

const editor = monaco.editor.create(editorContainer, {
  value: SAMPLE_GCODE,
  language: currentMode,
  theme: 'vs-dark',
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
  lineNumbers: 'on',
  rulers: [80],
  wordWrap: 'off',
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  insertSpaces: true,
  renderWhitespace: 'boundary',
  bracketPairColorization: { enabled: false },
});

// ---------------------------------------------------------------------------
// Status bar updates
// ---------------------------------------------------------------------------
const statusPosition = document.getElementById('status-position')!;
const statusSelection = document.getElementById('status-selection')!;
const statusLang = document.getElementById('status-lang')!;
const filenameDisplay = document.getElementById('filename-display')!;

function updateLangLabel(mode: GcodeMode) {
  statusLang.textContent = mode === 'gcode-fdm' ? 'G-code (FDM)' : 'G-code (CNC/Laser)';
}

editor.onDidChangeCursorPosition((e) => {
  const pos = e.position;
  statusPosition.textContent = `行 ${pos.lineNumber}, 列 ${pos.column}`;
});

editor.onDidChangeCursorSelection((e) => {
  const sel = e.selection;
  if (!sel.isEmpty()) {
    const lines = sel.endLineNumber - sel.startLineNumber + 1;
    const model = editor.getModel()!;
    const chars = model.getValueInRange(sel).length;
    statusSelection.textContent = ` | ${lines > 1 ? `${lines}行` : ''}${chars}文字 選択中`;
  } else {
    statusSelection.textContent = '';
  }
});

editor.onDidChangeModelContent(() => {
  if (!isModified) {
    isModified = true;
    updateFilenameDisplay();
  }
});

function updateFilenameDisplay() {
  filenameDisplay.textContent = isModified ? `${currentFilename} ●` : currentFilename;
}

// ---------------------------------------------------------------------------
// Mode selector
// ---------------------------------------------------------------------------
const modeSelect = document.getElementById('mode-select') as HTMLSelectElement;

modeSelect.addEventListener('change', () => {
  currentMode = modeSelect.value as GcodeMode;
  const model = editor.getModel()!;
  monaco.editor.setModelLanguage(model, currentMode);
  updateLangLabel(currentMode);
});

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------
const btnTheme = document.getElementById('btn-theme')!;

btnTheme.addEventListener('click', () => {
  isDarkTheme = !isDarkTheme;
  monaco.editor.setTheme(isDarkTheme ? 'vs-dark' : 'vs');
  document.body.classList.toggle('light-theme', !isDarkTheme);
});

// ---------------------------------------------------------------------------
// New file
// ---------------------------------------------------------------------------
const btnNew = document.getElementById('btn-new')!;

btnNew.addEventListener('click', () => {
  if (isModified && !confirm('変更が保存されていません。新規作成しますか？')) return;
  editor.setValue('');
  currentFilename = 'untitled.gcode';
  isModified = false;
  updateFilenameDisplay();
});

// ---------------------------------------------------------------------------
// Open file
// ---------------------------------------------------------------------------
const btnOpen = document.getElementById('btn-open')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

btnOpen.addEventListener('click', () => {
  if (isModified && !confirm('変更が保存されていません。ファイルを開きますか？')) return;
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    editor.setValue(text);
    currentFilename = file.name;
    isModified = false;
    updateFilenameDisplay();

    // ファイル拡張子からモードを推定
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'nc' || ext === 'ngc' || ext === 'tap') {
      modeSelect.value = 'gcode-cnc';
      currentMode = 'gcode-cnc';
    } else {
      modeSelect.value = 'gcode-fdm';
      currentMode = 'gcode-fdm';
    }
    monaco.editor.setModelLanguage(editor.getModel()!, currentMode);
    updateLangLabel(currentMode);
  };
  reader.readAsText(file, 'UTF-8');

  // 同じファイルを再度開けるようにリセット
  fileInput.value = '';
});

// ---------------------------------------------------------------------------
// Save file
// ---------------------------------------------------------------------------
const btnSave = document.getElementById('btn-save')!;

function saveFile() {
  const content = editor.getValue();
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFilename;
  a.click();
  URL.revokeObjectURL(url);
  isModified = false;
  updateFilenameDisplay();
}

btnSave.addEventListener('click', saveFile);

// ---------------------------------------------------------------------------
// Find / Replace
// ---------------------------------------------------------------------------
const btnFind = document.getElementById('btn-find')!;

btnFind.addEventListener('click', () => {
  editor.trigger('toolbar', 'editor.action.startFindReplaceAction', null);
});

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------
editor.addAction({
  id: 'file-new',
  label: '新規作成',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN],
  run: () => btnNew.click(),
});

editor.addAction({
  id: 'file-open',
  label: 'ファイルを開く',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO],
  run: () => btnOpen.click(),
});

editor.addAction({
  id: 'file-save',
  label: '保存',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
  run: () => saveFile(),
});

// ---------------------------------------------------------------------------
// Drag & Drop support
// ---------------------------------------------------------------------------
editorContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  editorContainer.classList.add('dragover');
});

editorContainer.addEventListener('dragleave', () => {
  editorContainer.classList.remove('dragover');
});

editorContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  editorContainer.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (!file) return;
  if (isModified && !confirm('変更が保存されていません。ファイルを開きますか？')) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    editor.setValue(ev.target?.result as string);
    currentFilename = file.name;
    isModified = false;
    updateFilenameDisplay();
  };
  reader.readAsText(file, 'UTF-8');
});

// ---------------------------------------------------------------------------
// Gcode linter
// ---------------------------------------------------------------------------
attachGcodeLinter(editor);

// ---------------------------------------------------------------------------
// Gcode + object model providers (hover / completion)
// ---------------------------------------------------------------------------
installStaticObjectModelContext();
registerDuetProviders(monaco as Parameters<typeof registerDuetProviders>[0]);

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
updateLangLabel(currentMode);
updateFilenameDisplay();
editor.focus();
