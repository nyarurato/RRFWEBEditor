import { defineConfig } from 'vite';

// GitHub Actions では GITHUB_REPOSITORY が "owner/repo" 形式で提供される
// GitHub Pages プロジェクトサイトは /repo-name/ 以下に配置されるため base を設定する
const base = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : '/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor')) {
            return 'monaco-editor';
          }
        },
      },
    },
  },
});
