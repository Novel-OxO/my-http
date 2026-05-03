import { log } from "./tcp/log";

const MODES = ["server", "client", "backpressure", "udp-server", "udp-client"] as const;
type Mode = (typeof MODES)[number];

function parseMode(arg: string | undefined): Mode {
  if ((MODES as readonly string[]).includes(arg ?? "")) return arg as Mode;
  log.error(
    `unknown mode: ${arg ?? "(none)"}\nusage: pnpm start <${MODES.join("|")}>`,
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
    case "udp-server": {
      const { runUdpServer } = await import("./udp/echo-server");
      await runUdpServer();
      return;
    }
    case "udp-client": {
      const { runUdpClient } = await import("./udp/echo-client");
      await runUdpClient();
      return;
    }
  }
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});
