# ChatLab Client

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Deployment

### Prerequisites
- Node.js 23+
- Private key file (3dvar.pri) in the client folder

### Steps
1. Set permissions for the private key (first time only)
   ```bash
   chmod 600 client/3dvar.pri
   ```

2. Deploy
   ```bash
   ./deploy.sh
   ```

The script builds the application and deploys it to chatlab.3dvar.com.

## Optimization

- Code splitting for faster loading
- Asset preloading for critical resources
- Terser minification for smaller file sizes
