// src/lib/services.ts
import { supabase } from "./supabaseClient";
import { SERVICES as FALLBACK_SERVICES } from "./data";
import type { Service as UiService } from "@/types";

export type ServiceRow = {
  id: string;
  name: string;
  price: number;
  durationminutes: number; // coluna no banco
};

function mapRowToUiService(row: ServiceRow): UiService {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    durationMinutes: Number(row.durationminutes),
  };
}

// USAR NO SITE (passo 2: serviços)
export async function getServices(): Promise<UiService[]> {
  // Se supabase não estiver pronto, volta pro fallback
  if (!supabase) return FALLBACK_SERVICES;

  const { data, error } = await supabase
    .from("services")
    .select("id,name,price,durationminutes")
    .order("name", { ascending: true });

  // Se der erro OU vier vazio, volta pro fallback
  if (error || !data || data.length === 0) return FALLBACK_SERVICES;

  return (data as ServiceRow[]).map(mapRowToUiService);
}

// ADMIN (CRUD)
export async function upsertService(input: Partial<ServiceRow>) {
  if (!supabase) throw new Error("Supabase não configurado.");

  if (!input.id) throw new Error("id é obrigatório");
  if (!input.name) throw new Error("name é obrigatório");
  if (typeof input.price !== "number") throw new Error("price deve ser number");
  if (typeof input.durationminutes !== "number")
    throw new Error("durationminutes deve ser number");

  const { data, error } = await supabase
    .from("services")
    .upsert(
      [
        {
          id: input.id,
          name: input.name,
          price: input.price,
          durationminutes: input.durationminutes,
        },
      ],
      { onConflict: "id" }
    )
    .select("id,name,price,durationminutes");

  if (error) throw new Error(error.message);

  return (data?.[0] ?? null) as ServiceRow | null;
}

export async function deleteService(id: string) {
  if (!supabase) throw new Error("Supabase não configurado.");
  if (!id) throw new Error("id é obrigatório");

  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw new Error(error.message);

  return true;
}