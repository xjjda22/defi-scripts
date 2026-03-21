/**
 * When stdout is piped (e.g. `script | head`), the pipe may close early and
 * writes throw EPIPE — default Node behavior yields a non-zero exit. Swallow
 * EPIPE so successful runs exit 0.
 */
function installCliSafeStdout() {
  const onErr = err => {
    if (err && err.code === "EPIPE") {
      process.exit(0);
    }
  };
  process.stdout.on("error", onErr);
  process.stderr.on("error", onErr);
}

module.exports = { installCliSafeStdout };
