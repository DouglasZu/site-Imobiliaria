import { describe, expect, it } from "vitest";
import { loginSchema } from "@/lib/schemas/auth";

describe("loginSchema", () => {
  it("normaliza o e-mail sem alterar a senha", () => {
    const result = loginSchema.parse({
      email: "  Admin@Example.com ",
      password: " senha com espaços ",
    });

    expect(result.email).toBe("admin@example.com");
    expect(result.password).toBe(" senha com espaços ");
  });

  it("rejeita payload inesperado e entradas excessivas", () => {
    expect(
      loginSchema.safeParse({
        email: "admin@example.com",
        password: "password",
        role: "admin",
      }).success
    ).toBe(false);

    expect(
      loginSchema.safeParse({
        email: "admin@example.com",
        password: "x".repeat(129),
      }).success
    ).toBe(false);
  });
});
