import { ToolDefinition } from "./registry";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Memory tools — persistent user preferences/facts/context across conversations.
 *
 * These tools do NOT require write confirmation: they only record declarative
 * statements the user makes ("mi equipo principal es X", "prefiero entrenamientos
 * de 75 min") as a note-to-self. No Firestore data outside copilotMemory is affected.
 */

export type MemoryType = "preference" | "fact" | "context";

const MAX_CONTENT_LENGTH = 280;
const MAX_MEMORIES_PER_USER = 30;

export function createMemoryTools(): ToolDefinition[] {
  return [
    {
      name: "save_memory",
      description:
        "Guarda una memoria persistente del usuario que estará disponible en todas las conversaciones futuras. Úsalo cuando el usuario declara una preferencia, hecho sobre su contexto, o información que debería recordar. Tipos: 'preference' (prefiero X), 'fact' (mi equipo principal es Y), 'context' (estoy preparando la liga de primavera). NO uses esto para datos transitorios — usa save_note para eso.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["preference", "fact", "context"],
            description: "Categoría de la memoria",
          },
          content: {
            type: "string",
            description: `Contenido en una sola frase (máx ${MAX_CONTENT_LENGTH} caracteres).`,
          },
        },
        required: ["type", "content"],
      },
      handler: async (args, ctx) => {
        const type = args.type as MemoryType;
        const content = String(args.content || "").trim();
        if (!["preference", "fact", "context"].includes(type)) {
          throw new Error(`Tipo inválido: ${type}`);
        }
        if (!content) throw new Error("content vacío");
        const truncated = content.slice(0, MAX_CONTENT_LENGTH);

        const base = ctx.db
          .collection("artifacts")
          .doc(ctx.appId)
          .collection("users")
          .doc(ctx.userId);

        // Enforce cap: if over limit, drop oldest by lastUsedAt
        const col = base.collection("copilotMemory");
        const existing = await col.orderBy("lastUsedAt", "asc").get();
        if (existing.size >= MAX_MEMORIES_PER_USER) {
          const toDelete = existing.docs.slice(0, existing.size - MAX_MEMORIES_PER_USER + 1);
          await Promise.all(toDelete.map((d) => d.ref.delete()));
        }

        const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = Timestamp.now();
        await col.doc(id).set({
          id,
          type,
          content: truncated,
          createdAt: now,
          lastUsedAt: now,
        });

        return {
          saved: true,
          id,
          type,
          content: truncated,
          message: `Memoria guardada: "${truncated}"`,
        };
      },
    },

    {
      name: "list_memories",
      description:
        "Lista las memorias persistentes del usuario (preferencias, hechos, contexto). Las memorias ya están incluidas en el contexto inicial del prompt — usa esta tool solo si necesitas consultarlas explícitamente de nuevo.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["preference", "fact", "context"],
            description: "Filtrar por tipo (opcional)",
          },
        },
      },
      handler: async (args, ctx) => {
        const base = ctx.db
          .collection("artifacts")
          .doc(ctx.appId)
          .collection("users")
          .doc(ctx.userId);
        const col = base.collection("copilotMemory");
        let query = col.orderBy("lastUsedAt", "desc") as FirebaseFirestore.Query;
        if (args.type) {
          query = col.where("type", "==", args.type).orderBy("lastUsedAt", "desc");
        }
        const snap = await query.limit(MAX_MEMORIES_PER_USER).get();
        const memories = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id as string,
            type: data.type as MemoryType,
            content: data.content as string,
            createdAt: (data.createdAt as Timestamp | undefined)?.toMillis(),
          };
        });
        return { memories, count: memories.length };
      },
    },

    {
      name: "forget_memory",
      description:
        "Elimina una memoria persistente del usuario por id. Úsalo solo si el usuario pide explícitamente olvidar algo.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "id de la memoria a eliminar" },
        },
        required: ["id"],
      },
      handler: async (args, ctx) => {
        const id = String(args.id || "");
        if (!id) throw new Error("id vacío");
        const ref = ctx.db
          .collection("artifacts")
          .doc(ctx.appId)
          .collection("users")
          .doc(ctx.userId)
          .collection("copilotMemory")
          .doc(id);
        const snap = await ref.get();
        if (!snap.exists) return { deleted: false, message: `Memoria ${id} no encontrada` };
        await ref.delete();
        return { deleted: true, id, message: "Memoria eliminada" };
      },
    },
  ];
}

/**
 * Helper used by userDigest to fetch memories for prompt injection.
 * Returns up to `limit` memories ordered by recent use.
 */
export async function fetchMemoriesForDigest(
  db: FirebaseFirestore.Firestore,
  appId: string,
  userId: string,
  limit = 15
): Promise<Array<{ id: string; type: MemoryType; content: string }>> {
  const col = db
    .collection("artifacts")
    .doc(appId)
    .collection("users")
    .doc(userId)
    .collection("copilotMemory");
  const snap = await col.orderBy("lastUsedAt", "desc").limit(limit).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: data.id as string,
      type: data.type as MemoryType,
      content: data.content as string,
    };
  });
}
