import nextConfig from 'eslint-config-next/core-web-vitals';
import reactHooks from 'eslint-plugin-react-hooks';

// eslint-plugin-react 7.x is incompatible with ESLint v10 (removed getFilename API).
// Skip the first config block (react/react-hooks/jsx-a11y/import plugins).
// Re-add only the two classic react-hooks rules to resolve disable comments in code.
const [_reactBlock, ...rest] = nextConfig;

export default [
  ...rest,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
