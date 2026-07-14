import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

// GET /api/properties/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const property = await prisma.property.findUnique({
      where: { id },
      include: { images: { orderBy: { order: "asc" } } },
    });

    if (!property) {
      return Response.json({ error: "Imóvel não encontrado" }, { status: 404 });
    }

    // Inactive properties are only visible to authenticated admins
    if (!property.active) {
      const admin = await getCurrentAdmin();
      if (!admin) {
        return Response.json({ error: "Imóvel não encontrado" }, { status: 404 });
      }
    }

    return Response.json(property);
  } catch {
    return Response.json({ error: "Erro ao buscar imóvel" }, { status: 500 });
  }
}

// PUT /api/properties/[id] — Update (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const data = await request.json();

    const {
      title,
      description,
      price,
      city,
      neighborhood,
      address,
      type,
      purpose,
      bedrooms,
      bathrooms,
      area,
      whatsappPhone,
      featured,
      active,
      images,
    } = data;

    // Delete existing images and recreate
    if (images !== undefined) {
      await prisma.image.deleteMany({ where: { propertyId: id } });
    }

    const property = await prisma.property.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(city !== undefined && { city }),
        ...(neighborhood !== undefined && { neighborhood }),
        ...(address !== undefined && { address: address || null }),
        ...(type !== undefined && { type }),
        ...(purpose !== undefined && { purpose }),
        ...(bedrooms !== undefined && { bedrooms: bedrooms ? parseInt(bedrooms) : null }),
        ...(bathrooms !== undefined && { bathrooms: bathrooms ? parseInt(bathrooms) : null }),
        ...(area !== undefined && { area: area ? parseFloat(area) : null }),
        ...(whatsappPhone !== undefined && { whatsappPhone: whatsappPhone || null }),
        ...(featured !== undefined && { featured }),
        ...(active !== undefined && { active }),
        ...(images !== undefined && {
          images: {
            create: images.map((img: { url: string; publicId?: string }, index: number) => ({
              url: img.url,
              publicId: img.publicId || "",
              order: index,
            })),
          },
        }),
      },
      include: { images: { orderBy: { order: "asc" } } },
    });

    return Response.json(property);
  } catch (error) {
    console.error("Error updating property:", error);
    return Response.json({ error: "Erro ao atualizar imóvel" }, { status: 500 });
  }
}

// DELETE /api/properties/[id] — Delete (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return Response.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    await prisma.property.delete({ where: { id } });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erro ao excluir imóvel" }, { status: 500 });
  }
}
