export type Lang = 'en' | 'ja';

export interface Translations {
  btnNew: string;         btnNewTitle: string;
  btnOpen: string;        btnOpenTitle: string;
  btnSave: string;        btnSaveTitle: string;
  btnFind: string;        btnFindTitle: string;
  btnTheme: string;       btnThemeTitle: string;
  btnSettings: string;    btnSettingsTitle: string;
  modeLabel: string;
  settingsPanelLabel: string;
  wrapLabel: string;      wrapEnabledLabel: string;   wrapColumnUnit: string;
  indentLabel: string;    indentUnit: string;
  eolLabel: string;
  langLabel: string;
  statusLangFdm: string;  statusLangCnc: string;
  statusLine(line: number, col: number): string;
  statusSelection(lines: number, chars: number): string;
  confirmNew: string;
  confirmOpen: string;
  confirmDrop: string;
}

export const translations: Record<Lang, Translations> = {
  en: {
    btnNew: 'New',              btnNewTitle: 'New File (Ctrl+N)',
    btnOpen: 'Open',            btnOpenTitle: 'Open File (Ctrl+O)',
    btnSave: 'Save',            btnSaveTitle: 'Save File (Ctrl+S)',
    btnFind: 'Find/Replace',    btnFindTitle: 'Find/Replace (Ctrl+H)',
    btnTheme: 'Theme',          btnThemeTitle: 'Toggle Theme',
    btnSettings: '⚙ Settings', btnSettingsTitle: 'Settings',
    modeLabel: 'Mode:',
    settingsPanelLabel: 'Editor Settings',
    wrapLabel: 'Word Wrap',     wrapEnabledLabel: 'Enabled',  wrapColumnUnit: 'col',
    indentLabel: 'Indent',      indentUnit: 'spaces',
    eolLabel: 'Line Ending',
    langLabel: 'Language',
    statusLangFdm: 'G-code (FDM)',
    statusLangCnc: 'G-code (CNC/Laser)',
    statusLine: (line, col) => `Ln ${line}, Col ${col}`,
    statusSelection: (lines, chars) =>
      lines > 1 ? ` | ${lines} lines, ${chars} chars` : ` | ${chars} chars`,
    confirmNew: 'Unsaved changes. Create new file?',
    confirmOpen: 'Unsaved changes. Open file?',
    confirmDrop: 'Unsaved changes. Open dropped file?',
  },
  ja: {
    btnNew: '新規',             btnNewTitle: '新規作成 (Ctrl+N)',
    btnOpen: '開く',            btnOpenTitle: 'ファイルを開く (Ctrl+O)',
    btnSave: '保存',            btnSaveTitle: 'ファイルに保存 (Ctrl+S)',
    btnFind: '検索/置換',       btnFindTitle: '検索/置換 (Ctrl+H)',
    btnTheme: 'テーマ切替',     btnThemeTitle: 'テーマ切替',
    btnSettings: '⚙ 設定',     btnSettingsTitle: '設定',
    modeLabel: 'モード:',
    settingsPanelLabel: 'エディタ設定',
    wrapLabel: '折り返し',      wrapEnabledLabel: '有効',     wrapColumnUnit: '列',
    indentLabel: 'インデント',  indentUnit: 'スペース',
    eolLabel: '改行の種類',
    langLabel: '言語',
    statusLangFdm: 'G-code (FDM)',
    statusLangCnc: 'G-code (CNC/Laser)',
    statusLine: (line, col) => `行 ${line}, 列 ${col}`,
    statusSelection: (lines, chars) =>
      lines > 1 ? ` | ${lines}行 ${chars}文字 選択中` : ` | ${chars}文字 選択中`,
    confirmNew: '変更が保存されていません。新規作成しますか？',
    confirmOpen: '変更が保存されていません。ファイルを開きますか？',
    confirmDrop: '変更が保存されていません。ファイルを開きますか？',
  },
};

/** ブラウザの言語設定から自動検出 */
export function detectLang(): Lang {
  return navigator.language.startsWith('ja') ? 'ja' : 'en';
}
