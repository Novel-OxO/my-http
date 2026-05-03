import { log } from "./tcp/log";

type Mode = "server" | "client" | "backpressure";

function parseMode(arg: string | undefined): Mode {
  if (arg === "server" || arg === "client" || arg === "backpressure") {
    return arg;
  }
  log.error(
    `unknown mode: ${arg ?? "(none)"}\nusage: pnpm start <server|client|backpressure>`,
  );
  process.exit(1);
}

async function main() {
  const mode = parseMode(process.argv[2]);
  log.info(`mode=${mode}`);

  switch (mode) {
    case "server": {
      const { runServer } = await import("./tcp/echo-server");
      await runServer();
      return;
    }
    case "client": {
      const { runClient } = await import("./tcp/echo-client");
      await runClient();
      return;
    }
    case "backpressure": {
      const { runBackpressureDemo } = await import("./tcp/backpressure-demo");
      await runBackpressureDemo();
      return;
    }
  }
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
