import './style.css';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { gcodeFDMLanguage, gcodeCNCLanguage } from '@duet3d/monacotokens';
import { attachGcodeLinter } from './gcode-linter';
import { registerDuetProviders } from '@duet3d/monacotokens/dist/providers';
import { installStaticObjectModelContext } from './objectmodel-context';
import { type Lang, translations, loadLang, saveLang } from './i18n';

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
let currentMode: GcodeMode = 'gcode-cnc';
let isModified = false;
let currentLang: Lang = loadLang();

const SAMPLE_GCODE = `; RRF Web Editor - Sample G-code
; CNC milling for RepRapFirmware

G21           ; Set units to millimeters
G90           ; Absolute positioning
G28           ; Home all axes
M3 S10000     ; Start spindle at 10000 RPM
G4 P2         ; Wait 2 seconds for spindle to spin up

; Move to start position
G0 Z5
G0 X0 Y0

; Contour pass
G1 Z-1 F200   ; Plunge to depth
G1 X100 F800
G1 Y100
G1 X0
G1 Y0

; Retract and finish
G0 Z10
M5            ; Stop spindle
G0 X0 Y0      ; Return to home
M84           ; Disable motors
`;

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------
monaco.editor.defineTheme('gcode-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    // G/M/T codes and meta-keywords (if / while / set / var …)
    { token: 'keyword',       foreground: '569CD6' },
    // { } that opens/closes an expression — purple to signal expression context
    { token: 'expression',    foreground: 'C586C0' },
    // object model paths: move.axes[0].position, heat.heaters[0].current …
    { token: 'variable',      foreground: '4EC9B0' },
    // user-defined variables: global.<n>, var.<n>, param.<n>
    { token: 'variable.name', foreground: 'DCDCAA' },
    // built-in constants: true / false / null / pi / iterations …
    { token: 'constant',      foreground: '9CDCFE' },
    { token: 'number',        foreground: 'B5CEA8' },
    { token: 'number.float',  foreground: 'B5CEA8' },
    { token: 'number.hex',    foreground: 'B5CEA8' },
    { token: 'string',        foreground: 'CE9178' },
    { token: 'comment',       foreground: '6A9955', fontStyle: 'italic' },
    { token: 'operator',      foreground: 'D4D4D4' },
    { token: 'invalid',       foreground: 'F44747', fontStyle: 'underline' },
  ],
  colors: {},
});

monaco.editor.defineTheme('gcode-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword',       foreground: '0000FF' },
    { token: 'expression',    foreground: 'AF00DB' },
    { token: 'variable',      foreground: '267F99' },
    { token: 'variable.name', foreground: '795E26' },
    { token: 'constant',      foreground: '0070C1' },
    { token: 'number',        foreground: '098658' },
    { token: 'number.float',  foreground: '098658' },
    { token: 'number.hex',    foreground: '098658' },
    { token: 'string',        foreground: 'A31515' },
    { token: 'comment',       foreground: '008000', fontStyle: 'italic' },
    { token: 'operator',      foreground: '000000' },
    { token: 'invalid',       foreground: 'CD3131', fontStyle: 'underline' },
  ],
  colors: {},
});

// ---------------------------------------------------------------------------
// Editor creation
// ---------------------------------------------------------------------------
const editorContainer = document.getElementById('editor-container')!;

const editor = monaco.editor.create(editorContainer, {
  value: SAMPLE_GCODE,
  language: currentMode,
  theme: 'gcode-dark',
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
  lineNumbers: 'on',
  rulers: [],
  wordWrap: 'off',
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
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
const statusEol = document.getElementById('status-eol')!;
const filenameDisplay = document.getElementById('filename-display')!;

function updateLangLabel(mode: GcodeMode) {
  const T = translations[currentLang];
  statusLang.textContent = mode === 'gcode-fdm' ? T.statusLangFdm : T.statusLangCnc;
}

editor.onDidChangeCursorPosition((e) => {
  const pos = e.position;
  statusPosition.textContent = translations[currentLang].statusLine(pos.lineNumber, pos.column);
});

editor.onDidChangeCursorSelection((e) => {
  const sel = e.selection;
  if (!sel.isEmpty()) {
    const lines = sel.endLineNumber - sel.startLineNumber + 1;
    const model = editor.getModel()!;
    const chars = model.getValueInRange(sel).length;
    statusSelection.textContent = translations[currentLang].statusSelection(lines, chars);
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
  monaco.editor.setTheme(isDarkTheme ? 'gcode-dark' : 'gcode-light');
  document.body.classList.toggle('light-theme', !isDarkTheme);
});

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------
const btnSettings = document.getElementById('btn-settings')!;
const settingsPanel = document.getElementById('settings-panel')!;
const wrapEnabled = document.getElementById('wrap-enabled') as HTMLInputElement;
const wrapColumn = document.getElementById('wrap-column') as HTMLInputElement;
const eolSelect = document.getElementById('eol-select') as HTMLSelectElement;
const indentSize = document.getElementById('indent-size') as HTMLInputElement;

function applyIndentSettings() {
  const size = Math.max(1, Math.min(8, parseInt(indentSize.value) || 2));
  indentSize.value = String(size);
  editor.getModel()?.updateOptions({ tabSize: size, insertSpaces: true });
}

function applyWrapSettings() {
  const col = Math.max(20, Math.min(500, parseInt(wrapColumn.value) || 80));
  wrapColumn.value = String(col);
  editor.updateOptions({
    wordWrap: wrapEnabled.checked ? 'wordWrapColumn' : 'off',
    wordWrapColumn: col,
    rulers: wrapEnabled.checked ? [col] : [],
  });
}

function updateEolLabel() {
  const model = editor.getModel();
  if (!model) return;
  const eol = model.getEOL();
  statusEol.textContent = eol === '\r\n' ? 'CRLF' : 'LF';
  eolSelect.value = eol === '\r\n' ? 'crlf' : 'lf';
}

wrapEnabled.addEventListener('change', () => {
  wrapColumn.disabled = false; // always editable (shows ruler even when wrap off)
  applyWrapSettings();
});

wrapColumn.addEventListener('change', applyWrapSettings);

indentSize.addEventListener('change', applyIndentSettings);

eolSelect.addEventListener('change', () => {
  const model = editor.getModel();
  if (!model) return;
  model.setEOL(
    eolSelect.value === 'crlf'
      ? monaco.editor.EndOfLineSequence.CRLF
      : monaco.editor.EndOfLineSequence.LF
  );
  updateEolLabel();
});

btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  if (settingsPanel.classList.contains('hidden')) {
    const rect = btnSettings.getBoundingClientRect();
    // Anchor to bottom-right of button; clamp so panel stays on screen
    const panelW = 234;
    let left = rect.right - panelW;
    if (left < 4) left = 4;
    settingsPanel.style.top = `${rect.bottom + 4}px`;
    settingsPanel.style.left = `${left}px`;
    settingsPanel.classList.remove('hidden');
  } else {
    settingsPanel.classList.add('hidden');
  }
});

document.addEventListener('click', () => settingsPanel.classList.add('hidden'));
settingsPanel.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') settingsPanel.classList.add('hidden');
});

const langSelect = document.getElementById('lang-select') as HTMLSelectElement;

langSelect.addEventListener('change', () => {
  currentLang = langSelect.value as Lang;
  saveLang(currentLang);
  applyTranslations();
});

// ---------------------------------------------------------------------------
// New file
// ---------------------------------------------------------------------------
const btnNew = document.getElementById('btn-new')!;

btnNew.addEventListener('click', () => {
  if (isModified && !confirm(translations[currentLang].confirmNew)) return;
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
  if (isModified && !confirm(translations[currentLang].confirmOpen)) return;
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
    updateEolLabel();
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
const btnCommandPalette = document.getElementById('btn-command-palette')!;

btnFind.addEventListener('click', () => {
  editor.trigger('toolbar', 'editor.action.startFindReplaceAction', null);
});

btnCommandPalette.addEventListener('click', () => {
  editor.focus();
  // Delay one tick so the editor regains focus before the palette opens
  setTimeout(() => editor.trigger('keyboard', 'editor.action.quickCommand', null), 0);
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
  if (isModified && !confirm(translations[currentLang].confirmDrop)) return;

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
// i18n: apply translations to all UI elements
// ---------------------------------------------------------------------------
function applyTranslations() {
  const T = translations[currentLang];
  document.documentElement.lang = currentLang;
  btnNew.textContent = T.btnNew;           btnNew.title = T.btnNewTitle;
  btnOpen.textContent = T.btnOpen;         btnOpen.title = T.btnOpenTitle;
  btnSave.textContent = T.btnSave;         btnSave.title = T.btnSaveTitle;
  btnFind.textContent = T.btnFind;         btnFind.title = T.btnFindTitle;
  btnCommandPalette.textContent = T.btnCommandPalette; btnCommandPalette.title = T.btnCommandPaletteTitle;
  btnTheme.textContent = T.btnTheme;       btnTheme.title = T.btnThemeTitle;
  btnSettings.textContent = T.btnSettings; btnSettings.title = T.btnSettingsTitle;
  document.getElementById('mode-label')!.textContent = T.modeLabel;
  settingsPanel.setAttribute('aria-label', T.settingsPanelLabel);
  document.getElementById('settings-wrap-label')!.textContent = T.wrapLabel;
  document.getElementById('wrap-enabled-label')!.textContent = T.wrapEnabledLabel;
  document.getElementById('wrap-column-unit')!.textContent = T.wrapColumnUnit;
  document.getElementById('settings-indent-label')!.textContent = T.indentLabel;
  document.getElementById('indent-unit')!.textContent = T.indentUnit;
  document.getElementById('settings-eol-label')!.textContent = T.eolLabel;
  document.getElementById('settings-lang-label')!.textContent = T.langLabel;
  langSelect.value = currentLang;
  updateLangLabel(currentMode);
  const pos = editor.getPosition() ?? { lineNumber: 1, column: 1 };
  statusPosition.textContent = T.statusLine(pos.lineNumber, pos.column);
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
applyTranslations();
updateFilenameDisplay();
editor.focus();
