# Build Steps for Vite + React + TypeScript

## Initialisation

### Create React TS template
(Ensure node.js is installed)
- `npm create vite@latest` to create a template
- `react-app` as the project name
- Select **React** as the framework
- And **TypeScript** as the variant
- The project template is created

### Structure
The template mainly contains:
- `node_modules` - Installed npm packages (auto-generated, not committed)
- `public/`  
  Static files copied directly to the final build without processing
- `src/`  
  Main application source code (React + TypeScript)
- `.gitignore`  
- `eslint.config.js`  
  ESLint configuration for code quality and linting rules
- `index.html`
- `package.json`
  Project metadata, scripts, and dependencies
- `package-lock.json`  
  Exact dependency versions for consistent installs
- `tsconfig.json`  
  Base TypeScript configuration (shared settings)
- `tsconfig.app.json` 
  TypeScript config for React app source
- `tsconfig.node.json`  
  TypeScript config for Node-related files
- `vite.config.ts`  
  Vite configuration file (plugins, build options, base path...)

### Check gitignore
The template `.gitignore` should exclude dist/ node-modules/ etc.

## Development
Open `react-app/` in VSCode and:

### Initialisation
You may need to run `npm install` in the `react-app/` directory to install dependacies.

### Dev Server
The dev server starts upon creating the template and provides the port and url to view it locally.

To start it again in the `react-app/` directory run `npm run dev`. Any changes in `src/` will refresh the browser.

### Build
In the `react-app/` directory run `npm run build` to generate static files to `react-app/dist`.

Run `npm run preview` to preview the static site from a local server.

### Deploying
For deployment I will be pushing the contents of `react-app/dist` to the `gh-pages` branch to overwrite with the current build.
