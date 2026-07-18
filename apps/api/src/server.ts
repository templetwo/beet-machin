import Fastify from "fastify";

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });

app.get("/api/v1/health", async () => ({
  ok: true,
  service: "beet-machin-api",
  version: "0.1.0",
  time: new Date().toISOString()
}));

const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
