import * as monaco from 'monaco-editor';
import { findGcode } from '@duet3d/monacotokens/dist/gcodes/index';

// RRF メタコマンド（G/M コードではない行）
const META_RE = /^\s*(if|elif|else|while|break|continue|return|set|var|global|echo|abort|const)\b/i;

// G/M コードのパターン（例: G0, G38.2, M104）
const GM_RE = /\b([GM]\d+(?:\.\d+)?)\b/gi;

function lintModel(model: monaco.editor.ITextModel): monaco.editor.IMarkerData[] {
  const markers: monaco.editor.IMarkerData[] = [];
  const lineCount = model.getLineCount();

  for (let ln = 1; ln <= lineCount; ln++) {
    const line = model.getLineContent(ln);

    // 空行・コメント行・メタコマンド行はスキップ
    if (!line.trim() || line.trimStart().startsWith(';') || META_RE.test(line)) {
      continue;
    }

    // 行末コメントを除去
    const sc = line.indexOf(';');
    const codeSection = sc >= 0 ? line.substring(0, sc) : line;

    // G/M コードを検索して検証
    GM_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = GM_RE.exec(codeSection)) !== null) {
      const code = match[1].toUpperCase();
      if (!findGcode(code)) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: `不明なGコード: ${code}`,
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
