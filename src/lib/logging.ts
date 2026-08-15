import "server-only";

export function logServerError(event: string, error: unknown) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      event,
      error: error instanceof Error ? error.name : "UnknownError",
      ...(code ? { code } : {}),
    })
  );
}
