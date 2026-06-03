import { Client, Connection } from "@temporalio/client";
import { temporalConnectionConfig } from "./connection";

let client: Client | null = null;

// Returns a shared Temporal client, connecting on first use. Connections are
// expensive, so reuse this across the app.
export async function getTemporalClient(): Promise<Client> {
  if (client) return client;

  const config = temporalConnectionConfig();
  const connection = await Connection.connect({
    address: config.address,
    apiKey: config.apiKey,
    tls: config.tls,
    metadata: { "temporal-namespace": config.namespace },
  });

  client = new Client({ connection, namespace: config.namespace });
  return client;
}
