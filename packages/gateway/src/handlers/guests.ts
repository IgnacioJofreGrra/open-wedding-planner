import { eq } from "drizzle-orm";
import { guests } from "../db/schema.js";
import type { Router, Db } from "../infra/router.js";
import type { GatewayEvent } from "@wedding-planner/shared";

export function registerGuestHandlers(router: Router, broadcast?: (event: GatewayEvent) => void) {
  const notify = () => broadcast?.({ name: "data.changed", data: { entity: "guests" } });

  router.register("guests.list", async (db: Db) => {
    return db.select().from(guests).orderBy(guests.createdAt);
  });

  router.register("guests.get", async (db: Db, params: unknown) => {
    const { id } = params as { id: number };
    const [row] = await db.select().from(guests).where(eq(guests.id, id));
    if (!row) throw new Error(`Guest ${id} not found`);
    return row;
  });

  router.register("guests.create", async (db: Db, params: unknown) => {
    const data = params as typeof guests.$inferInsert;
    const [row] = await db.insert(guests).values(data).returning();
    notify();
    return row;
  });

  router.register("guests.update", async (db: Db, params: unknown) => {
    const { id, ...data } = params as { id: number } & Record<string, unknown>;
    await db.update(guests).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(guests.id, id));
    const [updated] = await db.select().from(guests).where(eq(guests.id, id));
    notify();
    return updated;
  });

  router.register("guests.delete", async (db: Db, params: unknown) => {
    const { id } = params as { id: number };
    await db.delete(guests).where(eq(guests.id, id));
    notify();
    return { ok: true };
  });
}
