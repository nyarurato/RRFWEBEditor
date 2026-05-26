import { defineConfig } from 'vite';
import path from 'path';

// GitHub Actions では GITHUB_REPOSITORY が "owner/repo" 形式で提供される
// GitHub Pages プロジェクトサイトは /repo-name/ 以下に配置されるため base を設定する
const base = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
  : '/';

export default defineConfig({
  base,
  resolve: {
    alias: {
      // @duet3d/objectmodel v3.6.x has no exports map — manually point the
      // sub-path imports used by @duet3d/monacotokens to the dist files.
      '@duet3d/objectmodel/enums.json': path.resolve(
        'node_modules/@duet3d/objectmodel/dist/enums.json'
      ),
      '@duet3d/objectmodel/deprecations.json': path.resolve(
        'node_modules/@duet3d/objectmodel/dist/deprecations.json'
      ),
    },
  },
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
