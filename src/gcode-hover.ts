import * as monaco from 'monaco-editor';
import { findGcode } from '@duet3d/monacotokens/dist/gcodes/index';
import type { GcodeInfo } from '@duet3d/monacotokens/dist/gcodes/index';

// G/M コードパターン
const GM_RE = /\b([GM]\d+(?:\.\d+)?)\b/gi;
// T コードパターン（T0, T1, T-1 など）
const T_RE = /\b(T)(?=[-\d\s;]|$)/g;

/** カーソル列に該当する G/M/T コードを返す（なければ null）*/
function getCodeAtColumn(lineContent: string, column: number): string | null {
  // 行末コメントを除去
  const sc = lineContent.indexOf(';');
  const codeSection = sc >= 0 ? lineContent.substring(0, sc) : lineContent;

  // G/M コード検索
  GM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GM_RE.exec(codeSection)) !== null) {
    const start = m.index + 1;           // 1-based
    const end   = m.index + m[0].length; // 1-based, inclusive
    if (column >= start && column <= end) {
      return m[1].toUpperCase();
    }
  }

  // T コード検索
  T_RE.lastIndex = 0;
  while ((m = T_RE.exec(codeSection)) !== null) {
    const start = m.index + 1;
    const end   = m.index + 1; // T は 1 文字
    if (column >= start && column <= end) {
      return 'T';
    }
  }

  return null;
}

/** GcodeInfo を Markdown テキストに変換する */
function buildMarkdown(info: GcodeInfo): string {
  const lines: string[] = [];

  // ヘッダー: コード名 + 概要
  if (info.deprecated) {
    lines.push(`### ~~${info.code}~~ — ${info.summary}`);
    lines.push(`> ⚠️ **非推奨**: ${info.deprecated}`);
  } else {
    lines.push(`### ${info.code} — ${info.summary}`);
  }

  // 詳細説明（存在する場合）
  if (info.description) {
    lines.push('');
    lines.push(info.description);
  }

  // 位置引数（M117 のメッセージ、T のツール番号など）
  if (info.unprecedentedParameter) {
    lines.push('');
    lines.push(
      `**引数:** \`${info.unprecedentedParameter.label}\` — ${info.unprecedentedParameter.description}`
    );
  }

  // パラメータ一覧
  if (info.parameters.length > 0) {
    lines.push('');
    lines.push('**パラメータ:**');
    lines.push('');
    lines.push('| 文字 | 説明 |');
    lines.push('|:----:|------|');

    for (const p of info.parameters) {
      const letter = p.deprecated ? `~~\`${p.letter}\`~~` : `\`${p.letter}\``;
      let desc = p.description;

      // 選択肢がある場合は列挙
      if (p.values && p.values.length > 0) {
        const vals = p.values
          .map(v => `\`${v.value}\` ${v.description}`)
          .join(', ');
        desc += ` (${vals})`;
      }

      if (p.deprecated) {
        desc += ` *(非推奨: ${p.deprecated})*`;
      }

      lines.push(`| ${letter} | ${desc} |`);
    }
  }

  return lines.join('\n');
}

/**
 * gcode-fdm / gcode-cnc 両言語にホバープロバイダを登録する。
 * カーソル位置の G/M/T コードを検出し、Duet3D 公式データベースから
 * 概要・パラメータ説明をホバーポップアップで表示する。
 */
export function registerGcodeHoverProvider(): monaco.IDisposable {
  const disposables = (['gcode-fdm', 'gcode-cnc'] as const).map(lang =>
    monaco.languages.registerHoverProvider(lang, {
      provideHover(model, position) {
        const line = model.getLineContent(position.lineNumber);
        const code = getCodeAtColumn(line, position.column);
        if (!code) return null;

        const info = findGcode(code);
        if (!info) return null;

        return {
          contents: [
            { value: buildMarkdown(info), isTrusted: true },
          ],
        };
      },
    })
  );

  return {
    dispose() {
      disposables.forEach(d => d.dispose());
    },
  };
}
