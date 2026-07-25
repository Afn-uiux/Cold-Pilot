const { spawn } = require("child_process");
spawn("npx", ["next", "start", "-p", "3000"], { stdio: "inherit", shell: true });
