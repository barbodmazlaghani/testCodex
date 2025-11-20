# Fleet Efficiency Dashboard (Electron)

This project packages the provided React fuel-consumption dashboard into a desktop executable using Electron and Vite.

## Prerequisites
- Node.js 18+
- npm
- Windows for generating the `.exe` (Electron Builder targets Windows when run on Windows).

## Development
```bash
npm install
npm run dev
```
The dev script launches Vite (port 5173) and opens the Electron shell pointing at the dev server.

## Build static assets
```bash
npm run build
```
Outputs a production React build into `dist/` (used by Electron packaging).

## Package a Windows `.exe`
Run on Windows (or in a Windows container/VM):
```bash
npm install
npm run dist
```
Electron Builder will create an installer `.exe` in the `dist/` directory (`dist/win-unpacked` and `dist/*.exe`). The `build` section in `package.json` is preconfigured for an NSIS installer.

## Notes
- UI styling uses utility classes similar to Tailwind. A minimal dark theme is included in `src/index.css` so the layout renders nicely without additional setup.
- The dataset and charts live in `src/App.tsx`. Adjust `rawData` or chart settings there if needed.
