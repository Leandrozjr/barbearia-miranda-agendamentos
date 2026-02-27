// src/lib/services.ts
import { supabase } from "./supabaseClient";

export type ServiceRow = {
  id: string;
  name: string;
  price: number;
  durationminutes: number;
};

export async function getServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao buscar services:", error);
    return [];
  }

  return data ?? [];
}

export async function upsertService(service: ServiceRow) {
  const { error } = await supabase
    .from("services")
    .upsert(service, { onConflict: "id" });

  if (error) throw error;
}

export async function deleteService(id: string) {
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id);

  if (error) throw error;
}