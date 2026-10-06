import { execFile } from 'node:child_process';

const GIT_TIMEOUT_MS = 30_000;

export function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { cwd, timeout: GIT_TIMEOUT_MS, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      (err, stdout, stderr) => (err ? reject(Object.assign(err, { stderr })) : resolve(stdout)),
    );
  });
}

export function createPublisher({ repoDir, filePath, run = runCommand, log = console }) {
  let queue = Promise.resolve();

  async function publishNow(message) {
    await run('git', ['add', filePath], repoDir);
    await run('git', ['commit', '-m', message, '--', filePath], repoDir);
    try {
      await run('git', ['push'], repoDir);
      return { committed: true, pushed: true };
    } catch (err) {
      log.warn(`git push failed: ${err.stderr || err.message}`);
      return { committed: true, pushed: false };
    }
  }

  return {
    publish(message) {
      const job = queue.then(() => publishNow(message));
      queue = job.catch(() => {});
      return job;
    },
  };
}
