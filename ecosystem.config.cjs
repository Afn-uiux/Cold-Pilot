module.exports = {
  apps: [{
    name: 'coldpilot',
    script: 'node_modules/next/dist/bin/next',
    args: 'dev --port 3000',
    cwd: 'C:\\Users\\user\\Documents\\coldpilot',
    autorestart: true
  }]
};
