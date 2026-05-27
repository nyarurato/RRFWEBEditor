import * as monaco from 'monaco-editor';
import { findGcode } from '@duet3d/monacotokens/dist/gcodes/index';

// RRF メタコマンド（G/M コードではない行）
const META_RE = /^\s*(if|elif|else|while|break|continue|return|set|var|global|echo|abort|const)\b/i;

// G/M コードのパターン（例: G0, G38.2, M104）
const GM_RE = /\b([GM]\d+(?:\.\d+)?)\b/gi;

// 変数アクセスのドット抜けパターン（var xxx / global xxx / param xxx / const xxx）
// 正しい記法: var.name / global.name / param.name / const.name
const VAR_NO_DOT_RE = /\b(var|global|param|const)\s+([a-zA-Z_]\w*)/gi;

// 行頭の変数・定数宣言パターン（var/global/const name = ...）
const VAR_DECL_RE = /^\s*(var|global|const)\s+([a-zA-Z_]\w*)\s*=/i;

// ② if/elif/while の条件なし（キーワードの後に何もない）
const COND_EMPTY_RE = /^\s*(if|elif|while)\s*(?:;|$)/i;

// ③ set コマンドに = がない（set <expr> だけで代入なし）
const SET_NO_EQ_RE = /^\s*set\s+(\S.*?)(?:\s*;.*)?$/i;

function checkBraces(
  code: string,
  ln: number,
  markers: monaco.editor.IMarkerData[]
): void {
  // ① 式ブロック { } の対応チェック
  let depth = 0;
  let openCol = -1;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '{') {
      if (depth === 0) openCol = i;
      depth++;
    } else if (code[i] === '}') {
      depth--;
      if (depth < 0) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `対応する '{' がない '}' です`,
          startLineNumber: ln,
          startColumn: i + 1,
          endLineNumber: ln,
          endColumn: i + 2,
        });
        depth = 0;
      }
    }
  }
  if (depth > 0) {
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: `'{' が閉じられていません。対応する '}' が必要です`,
      startLineNumber: ln,
      startColumn: openCol + 1,
      endLineNumber: ln,
      endColumn: openCol + 2,
    });
  }
}

function lintModel(model: monaco.editor.ITextModel): monaco.editor.IMarkerData[] {
  const markers: monaco.editor.IMarkerData[] = [];
  const lineCount = model.getLineCount();

  for (let ln = 1; ln <= lineCount; ln++) {
    const line = model.getLineContent(ln);
    const trimmed = line.trimStart();

    // 空行・コメント行はスキップ
    if (!trimmed || trimmed.startsWith(';')) {
      continue;
    }

    // 行末コメントを除去
    const sc = line.indexOf(';');
    const code = sc >= 0 ? line.substring(0, sc) : line;

    // --- ① 式ブロック { } 対応チェック（全行対象）---
    checkBraces(code, ln, markers);

    // --- ② if/elif/while の条件なしチェック ---
    if (COND_EMPTY_RE.test(line)) {
      const kwMatch = /^\s*(if|elif|while)/i.exec(line)!;
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `'${kwMatch[1].toLowerCase()}' の後に条件式がありません`,
        startLineNumber: ln,
        startColumn: kwMatch.index + 1,
        endLineNumber: ln,
        endColumn: kwMatch.index + kwMatch[1].length + 1,
      });
      continue;
    }

    // --- ③ set コマンドに = がないチェック ---
    if (/^\s*set\b/i.test(line)) {
      const setBody = SET_NO_EQ_RE.exec(line);
      if (setBody && !setBody[1].includes('=')) {
        const setIdx = line.toLowerCase().indexOf('set');
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `'set' コマンドに代入演算子 '=' がありません（例: set var.x = 1）`,
          startLineNumber: ln,
          startColumn: setIdx + 1,
          endLineNumber: ln,
          endColumn: line.trimEnd().length + 1,
        });
      }
    }

    // --- 変数ドット抜けチェック（全行対象）---
    // 行頭の宣言（var/global/const name = ...）の場合は最初のマッチを除外
    const declMatch = VAR_DECL_RE.exec(code);
    const leadingSpaces = code.length - code.trimStart().length;

    VAR_NO_DOT_RE.lastIndex = 0;
    let varMatch: RegExpExecArray | null;
    while ((varMatch = VAR_NO_DOT_RE.exec(code)) !== null) {
      // 行頭の宣言キーワード（var/global/const name = ...）はスキップ
      if (
        declMatch &&
        varMatch.index === leadingSpaces &&
        varMatch[1].toLowerCase() === declMatch[1].toLowerCase() &&
        varMatch[2] === declMatch[2]
      ) {
        continue;
      }
      const kw = varMatch[1].toLowerCase();
      const nm = varMatch[2];
      markers.push({
        severity: monaco.MarkerSeverity.Error,
        message: `'${kw} ${nm}' は無効な記法です。変数アクセスには '${kw}.${nm}' のようにドット記法を使用してください`,
        startLineNumber: ln,
        startColumn: varMatch.index + 1,
        endLineNumber: ln,
        endColumn: varMatch.index + varMatch[0].length + 1,
      });
    }

    // --- G/M コードチェック（メタコマンド行はスキップ）---
    if (META_RE.test(line)) {
      continue;
    }

    GM_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = GM_RE.exec(code)) !== null) {
      const gmCode = match[1].toUpperCase();
      if (!findGcode(gmCode)) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: `不明なGコード: ${gmCode}`,
          startLineNumber: ln,
          startColumn: match.index + 1,
          endLineNumber: ln,
          endColumn: match.index + match[0].length + 1,
        });
      }
    }
  }

  return markers;
}

/**
 * エディタにGコード構文チェックを付与する。
 * 500ms のデバウンスで内容変更時に再チェックし、
 * 不明なコードに警告マーカーを表示する。
 */
export function attachGcodeLinter(
  editor: monaco.editor.IStandaloneCodeEditor
): monaco.IDisposable {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(model, 'gcode-linter', lintModel(model));
  };

  const schedule = () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, 500);
  };

  // アタッチ直後に即時実行
  run();

  const d1 = editor.onDidChangeModelContent(schedule);
  const d2 = editor.onDidChangeModel(() => {
    if (timer !== null) clearTimeout(timer);
    run();
  });

  return {
    dispose() {
      if (timer !== null) clearTimeout(timer);
      d1.dispose();
      d2.dispose();
      const model = editor.getModel();
      if (model) monaco.editor.setModelMarkers(model, 'gcode-linter', []);
    },
  };
}
