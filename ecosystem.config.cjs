module.exports = {
  apps: [{
    name: 'coldpilot',
    script: 'node_modules/next/dist/bin/next',
    // Production must run the compiled app via `next start`, never `next dev`.
    // (For a local dev process, override with: pm2 start ecosystem.config.cjs --only coldpilot-dev)
    args: 'start --port 3000',
    cwd: process.env.COLDPLOT_CWD || process.cwd(),
    env: {
      NODE_ENV: 'production'
    },
    autorestart: true,
    max_memory_restart: '1G'
  }]
};

