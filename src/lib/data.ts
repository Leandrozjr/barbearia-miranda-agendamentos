import type { Service, Barber, BusinessConfig } from "@/types";

export const BUSINESS_CONFIG: BusinessConfig = {
  name: "Estudio 3M",
  city: "Aracaju", // Inferido do @ESTUDIO3M.AJU na imagem
  phone: "79996604308",
  openTime: "08:00",
  closeTime: "18:00",
  daysOpen: [1, 2, 3, 4, 5, 6],
  slotInterval: 30,
  currency: "BRL"
};

export const SERVICES: Service[] = [
  // Cortes
  { id: "c1", name: "Corte Degradê", durationMinutes: 30, price: 35 },
  { id: "c2", name: "Corte na Tesoura", durationMinutes: 30, price: 35 },
  { id: "c3", name: "Corte Social", durationMinutes: 30, price: 30 },
  { id: "c4", name: "Corte Simples", durationMinutes: 25, price: 25 },
  
  // Barba
  { id: "b1", name: "Barba Simples", durationMinutes: 20, price: 20 },
  { id: "b2", name: "Barba Modelada", durationMinutes: 30, price: 20 },
  
  // Combos
  { id: "cb1", name: "Corte Simples + Barba", durationMinutes: 30, price: 45 },
  { id: "cb2", name: "Corte + Barba + Sobrancelha", durationMinutes: 50, price: 60 },
  
  // Sobrancelha
  { id: "s1", name: "Sobrancelhas Simples", durationMinutes: 15, price: 20 },
  { id: "s2", name: "Sobrancelhas de Henna", durationMinutes: 20, price: 30 },

  // Outros
  { id: "u1", name: "Unhas (Pé ou Mão)", durationMinutes: 30, price: 25 },
  { id: "u2", name: "Unhas (Pé e Mão)", durationMinutes: 60, price: 45 },

  // Micropigmentação (Marcio)
  { id: "m1", name: "Micropigmentação Fio a Fio", durationMinutes: 120, price: 399 },
  { id: "m2", name: "Renovação Micropigmentação", durationMinutes: 90, price: 250 },
];

export const HIDDEN_SERVICES: Service[] = [
  { id: "block-30", name: "Bloqueio (30 min)", durationMinutes: 30, price: 0 },
  { id: "block-60", name: "Bloqueio (1 hora)", durationMinutes: 60, price: 0 },
  { id: "block-90", name: "Bloqueio (1h 30m)", durationMinutes: 90, price: 0 },
  { id: "block-120", name: "Bloqueio (2 horas)", durationMinutes: 120, price: 0 },
  { id: "block-240", name: "Bloqueio (4 horas)", durationMinutes: 240, price: 0 },
];

// IDs de todos os serviços para facilitar atribuição
const ALL_SERVICE_IDS = SERVICES.map(s => s.id);
const NAIL_SERVICE_IDS = ["u1", "u2"];
const MICRO_SERVICE_IDS = ["m1", "m2"];

// Serviços padrão de barbeiro (EXCLUI Unhas e Micropigmentação)
const BARBER_SERVICE_IDS = ALL_SERVICE_IDS.filter(id => !NAIL_SERVICE_IDS.includes(id) && !MICRO_SERVICE_IDS.includes(id));

// Serviços do Marcio (Barbeiro + Micropigmentação)
const MARCIO_SERVICE_IDS = [...BARBER_SERVICE_IDS, ...MICRO_SERVICE_IDS];

export const BARBERS: Barber[] = [
  { 
    id: "barber1", 
    name: "Luis", 
    serviceIds: BARBER_SERVICE_IDS,
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luis&gender=male",
    phone: "79999089296"
  },
  { 
    id: "barber2", 
    name: "Marcio", 
    serviceIds: MARCIO_SERVICE_IDS,
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcio&gender=male",
    phone: "79996604308",
    openTime: "09:00"
  },
  { 
    id: "barber3", 
    name: "Junior", 
    serviceIds: BARBER_SERVICE_IDS,
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Junior&gender=male",
    phone: "79996604308"
  },
  { 
    id: "barber4", 
    name: "Aline", 
    serviceIds: NAIL_SERVICE_IDS,
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aline&gender=female",
    phone: "79996124480"
  }
];
