import Secrets from "@repo/secrets/backend";

function required(
  name: "TEMPORAL_API_KEY" | "TEMPORAL_ENDPOINT" | "TEMPORAL_NAMESPACE",
) {
  const value = Secrets[name];
  if (!value) {
    throw new Error(`${name} must be set to connect to Temporal Cloud.`);
  }
  return value;
}

// Shared Temporal Cloud connection settings (API-key auth). Used by the client
// now, and by workers later.
export function temporalConnectionConfig() {
  return {
    address: required("TEMPORAL_ENDPOINT"),
    apiKey: required("TEMPORAL_API_KEY"),
    namespace: required("TEMPORAL_NAMESPACE"),
    tls: true,
  };
}
