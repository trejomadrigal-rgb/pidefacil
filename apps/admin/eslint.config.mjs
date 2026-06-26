import nextConfig from 'eslint-config-next/core-web-vitals';

// eslint-plugin-react 7.x is incompatible with ESLint v10 (removed getFilename API).
// Skip the first config block which contains react/react-hooks/jsx-a11y/import plugins.
// Keep TypeScript (@typescript-eslint) and Next.js (@next/next) rules.
const [_reactBlock, ...rest] = nextConfig;

export default rest;
