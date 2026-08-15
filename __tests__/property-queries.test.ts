import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    property: {
      findUnique: mocks.findUnique,
    },
  },
}));

import { findAdminPropertyById } from "@/lib/queries/property";

describe("consultas administrativas de imóveis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ id: "admin", email: "admin@example.test" });
    mocks.findUnique.mockResolvedValue({ id: "property", images: [] });
  });

  it("carrega todas as imagens para o formulário de edição", async () => {
    await findAdminPropertyById("property");

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { id: "property" },
      include: { images: { orderBy: { order: "asc" } } },
    });
  });
});
