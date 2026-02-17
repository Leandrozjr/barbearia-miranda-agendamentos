import type { Appointment, Barber, Service, Expense } from "@/types";
import { BARBERS, SERVICES, HIDDEN_SERVICES, BUSINESS_CONFIG } from "./data";
import { format, addMinutes, parse, isBefore, isEqual, isAfter, startOfDay, isSaturday, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { nanoid } from "nanoid";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const STORAGE_KEY_APPS = "barbearia_appointments";
const STORAGE_KEY_USERS = "barbearia_users";
const STORAGE_KEY_BARBERS = "barbearia_barbers";
const STORAGE_KEY_EXPENSES = "barbearia_expenses";
const STORAGE_KEY_SERVICES = "barbearia_services";

export interface AdminUser {
  id: string;
  name: string;
  password?: string;
  isMaster: boolean;
  avatarUrl?: string;
}

// --- Helpers ---
const getStoredData = <T>(key: string): T | null => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

const saveData = <T>(key: string, data: T) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Initialization ---
export const initializeData = async () => {
  // Local Init
  
  // Init Services
  if (!getStoredData(STORAGE_KEY_SERVICES)) {
    saveData(STORAGE_KEY_SERVICES, SERVICES);
  }

  const storedBarbers = getStoredData<Barber[]>(STORAGE_KEY_BARBERS);
  if (!storedBarbers) {
    saveData(STORAGE_KEY_BARBERS, BARBERS);
  } else {
    // Force update phones and new services from constants
    const updatedBarbers = storedBarbers.map(sb => {
      const freshData = BARBERS.find(b => b.id === sb.id);
      return freshData ? { ...sb, phone: freshData.phone, serviceIds: freshData.serviceIds } : sb;
    });
    // Add new barbers if missing
    BARBERS.forEach(b => {
      if (!updatedBarbers.find(ub => ub.id === b.id)) {
        updatedBarbers.push(b);
      }
    });
    saveData(STORAGE_KEY_BARBERS, updatedBarbers);
  }

  if (!getStoredData(STORAGE_KEY_USERS)) {
    const defaultUsers: AdminUser[] = [
      { id: "admin", name: "Leandro", password: "admin123", isMaster: true },
      ...BARBERS.map(b => ({
        id: b.id,
        name: b.name,
        password: "admin123",
        isMaster: false,
        avatarUrl: b.avatarUrl
      }))
    ];
    saveData(STORAGE_KEY_USERS, defaultUsers);
  }
};

// --- Service Management ---
export const getServices = async (): Promise<Service[]> => {
  await initializeData();
  
  if (isSupabaseConfigured() && supabase) {
    // If we had a services table in Supabase, we would fetch here.
    // For now, let's assume services are still mostly local or we need to create a table.
    // Given the previous pattern, we might need a 'services' table script.
    // But to keep it simple and working with current structure (JSON in local), we stick to local for config
    // UNLESS we want to persist across devices.
    // Let's stick to localStorage for settings for now to avoid migration headaches, or use a JSON column.
    // Better: Allow saving to Supabase if table exists.
    
    // Check if services table exists (implicit check by trying to select)
    const { data, error } = await supabase.from('services').select('*');
    if (!error && data && data.length > 0) return data as Service[];
  }
  
  // Fallback / Local
  return getStoredData<Service[]>(STORAGE_KEY_SERVICES) || SERVICES;
};

export const updateServicePrice = async (id: string, newPrice: number) => {
  if (isSupabaseConfigured() && supabase) {
     await supabase.from('services').update({ price: newPrice }).eq('id', id);
  }

  const services = await getServices();
  const updated = services.map(s => s.id === id ? { ...s, price: newPrice } : s);
  saveData(STORAGE_KEY_SERVICES, updated);
};

export const addService = async (service: Service) => {
  if (isSupabaseConfigured() && supabase) {
    await supabase.from('services').insert(service);
  }
  const services = await getServices();
  services.push(service);
  saveData(STORAGE_KEY_SERVICES, services);
};

export const deleteService = async (id: string) => {
  if (isSupabaseConfigured() && supabase) {
    await supabase.from('services').delete().eq('id', id);
  }
  const services = await getServices();
  const updated = services.filter(s => s.id !== id);
  saveData(STORAGE_KEY_SERVICES, updated);
};

export const updateBarberSchedule = async (id: string, openTime: string, closeTime: string) => {
  // If Supabase is configured, ONLY confirm success if DB update succeeds.
  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase.from('barbers').update({ openTime, closeTime }).eq('id', id);
    if (error) throw error;
  }

  // Local override (also used as a resilient cache)
  const barbers = getStoredData<Barber[]>(STORAGE_KEY_BARBERS) || (await getBarbers());
  const updated = barbers.map(b => b.id === id ? { ...b, openTime, closeTime } : b);
  saveData(STORAGE_KEY_BARBERS, updated);
};

export const updateBarberServices = async (barberId: string, serviceIds: string[]) => {
  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase.from('barbers').update({ serviceIds }).eq('id', barberId);
    if (error) throw error;
  }

  const barbers = getStoredData<Barber[]>(STORAGE_KEY_BARBERS) || (await getBarbers());
  const updated = barbers.map(b => b.id === barberId ? { ...b, serviceIds } : b);
  saveData(STORAGE_KEY_BARBERS, updated);
};

// --- User Management ---
export const getUsers = async (): Promise<AdminUser[]> => {
  await initializeData();
  
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('users').select('*');
    if (!error && data) return data as AdminUser[];
  }
  
  return getStoredData<AdminUser[]>(STORAGE_KEY_USERS) || [];
};

export const updateUser = async (updatedUser: AdminUser) => {
  if (isSupabaseConfigured() && supabase) {
    // Update in Supabase
    await supabase.from('users').upsert(updatedUser);
    
    // If barber, update barber table too
    if (!updatedUser.isMaster) {
      await supabase.from('barbers').update({ 
        name: updatedUser.name, 
        avatarUrl: updatedUser.avatarUrl 
      }).eq('id', updatedUser.id);
    }
  } else {
    // Local Fallback
    const users = await getUsers();
    const newUsers = users.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u);
    saveData(STORAGE_KEY_USERS, newUsers);

    if (!updatedUser.isMaster) {
      const barbers = await getBarbers();
      const newBarbers = barbers.map(b => 
        b.id === updatedUser.id 
          ? { ...b, name: updatedUser.name, avatarUrl: updatedUser.avatarUrl } 
          : b
      );
      saveData(STORAGE_KEY_BARBERS, newBarbers);
    }
  }
};

export const getBarbers = async (): Promise<Barber[]> => {
  await initializeData();

  const localBarbers = getStoredData<Barber[]>(STORAGE_KEY_BARBERS) || BARBERS;

  let barbers: Barber[] = localBarbers;

  // If Supabase is available, try DB first; if it fails, fallback to local.
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('barbers').select('*');
    if (!error && data && data.length > 0) {
      barbers = data as Barber[];
    }
  }

  // HYBRID SYNC (resilient):
  // - phone + serviceIds: always from code (data.ts)
  // - openTime/closeTime: prefer LOCAL override if exists (admin just edited),
  //   otherwise use DB value, otherwise fallback to code.
  return barbers.map((b) => {
    const freshConfig = BARBERS.find((fb) => fb.id === b.id);
    const localOverride = localBarbers.find((lb) => lb.id === b.id);

    return {
      ...b,
      serviceIds: freshConfig?.serviceIds || b.serviceIds || [],
      phone: freshConfig?.phone || b.phone || "",
      openTime: localOverride?.openTime || b.openTime || freshConfig?.openTime,
      closeTime: localOverride?.closeTime || b.closeTime || freshConfig?.closeTime,
    };
  });
};

// --- Appointment Logic ---

export const getAppointments = async (): Promise<Appointment[]> => {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('appointments').select('*');
    if (!error && data) return data as Appointment[];
  }
  
  return getStoredData<Appointment[]>(STORAGE_KEY_APPS) || [];
};

export const createAppointment = async (
  data: Omit<Appointment, "id" | "status" | "createdAt">
): Promise<Appointment> => {
  const apps = await getAppointments();
  
  // Combine services to include hidden blocking services
  const ALL_SERVICES = [...(await getServices()), ...HIDDEN_SERVICES];

  // Validar conflito de horários considerando duração
  const service = ALL_SERVICES.find(s => s.id === data.serviceId);
  const newDuration = service?.durationMinutes || 30;
  
  const baseDate = parse(data.date, "yyyy-MM-dd", new Date());
  const newStart = parse(data.time, "HH:mm", baseDate);
  const newEnd = addMinutes(newStart, newDuration);

  const hasConflict = apps.some(a => {
    // Check confirmed AND blocked appointments
    if (a.barberId !== data.barberId || a.date !== data.date || (a.status !== 'confirmed' && a.status !== 'blocked')) return false;

    const existingService = ALL_SERVICES.find(s => s.id === a.serviceId);
    const existingDuration = existingService?.durationMinutes || 30;
    
    const existingStart = parse(a.time, "HH:mm", baseDate);
    const existingEnd = addMinutes(existingStart, existingDuration);

    return isBefore(newStart, existingEnd) && isAfter(newEnd, existingStart);
  });

  if (hasConflict) {
    throw new Error("Horário indisponível. Este serviço conflita com outro agendamento.");
  }

  const isBlock = HIDDEN_SERVICES.some(s => s.id === data.serviceId);
  
  const newApp: Appointment = {
    ...data,
    id: nanoid(),
    status: isBlock ? 'blocked' : 'confirmed',
    createdAt: new Date().toISOString()
  };

  if (isSupabaseConfigured() && supabase) {
    await supabase.from('appointments').insert(newApp);
  } else {
    apps.push(newApp);
    saveData(STORAGE_KEY_APPS, apps);
  }
  
  return newApp;
};

export const cancelAppointment = async (id: string) => {
  if (isSupabaseConfigured() && supabase) {
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
  } else {
    const apps = await getAppointments();
    const updated = apps.map(a => a.id === id ? { ...a, status: 'cancelled' as const } : a);
    saveData(STORAGE_KEY_APPS, updated);
  }
};

export const completeAppointment = async (id: string) => {
  if (isSupabaseConfigured() && supabase) {
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
  } else {
    const apps = await getAppointments();
    const updated = apps.map(a => a.id === id ? { ...a, status: 'completed' as const } : a);
    saveData(STORAGE_KEY_APPS, updated);
  }
};

export const clearAppointments = async () => {
  if (isSupabaseConfigured() && supabase) {
    // Para segurança, vamos apenas deletar todos
    await supabase.from('appointments').delete().neq('id', '0'); // Delete all
  } else {
    saveData(STORAGE_KEY_APPS, []);
  }
};

export const getAvailableSlots = async (dateStr: string, barberId: string, serviceId: string): Promise<string[]> => {
  const date = parse(dateStr, "yyyy-MM-dd", new Date());
  
  // Fetch barber specific hours if available
  const barbers = await getBarbers();
  const barber = barbers.find(b => b.id === barberId);
  
  const openTime = barber?.openTime || BUSINESS_CONFIG.openTime;
  const closeTime = isSaturday(date) ? "17:00" : (barber?.closeTime || BUSINESS_CONFIG.closeTime);

  const slots: string[] = [];
  let current = parse(openTime, "HH:mm", date);
  const end = parse(closeTime, "HH:mm", date);
  const service = (await getServices()).find(s => s.id === serviceId);
  if (!service) return [];

  const serviceDuration = service.durationMinutes;

  while (isBefore(current, end)) {
    const slotEnd = addMinutes(current, serviceDuration);
    if (isAfter(slotEnd, end) && !isEqual(slotEnd, end)) break;

    slots.push(format(current, "HH:mm"));
    current = addMinutes(current, BUSINESS_CONFIG.slotInterval);
  }

  // Filtro de horário passado (Brasília)
  const now = new Date();
  const brazilDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  if (dateStr === brazilDate) {
    const brazilTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
    
    const [currentHour, currentMinute] = brazilTimeStr.split(':').map(Number);
    
    // Remove slots que já passaram
    for (let i = slots.length - 1; i >= 0; i--) {
      const [slotHour, slotMinute] = slots[i].split(':').map(Number);
      if (slotHour < currentHour || (slotHour === currentHour && slotMinute <= currentMinute)) {
        slots.splice(i, 1);
      }
    }
  }

  const apps = await getAppointments();
  const barberApps = apps.filter(a => 
    a.barberId === barberId && 
    a.date === dateStr && 
    (a.status === 'confirmed' || a.status === 'blocked')
  );

  const services = await getServices();
  const ALL_SERVICES = [...services, ...HIDDEN_SERVICES];

  return slots.filter(slot => {
    const slotTime = parse(slot, "HH:mm", date);
    const slotEndTime = addMinutes(slotTime, serviceDuration);

    const hasConflict = barberApps.some(app => {
      const appTime = parse(app.time, "HH:mm", date);
      const appService = ALL_SERVICES.find(s => s.id === app.serviceId);
      const appDuration = appService?.durationMinutes || 30;
      const appEndTime = addMinutes(appTime, appDuration);

      return isBefore(slotTime, appEndTime) && isAfter(slotEndTime, appTime);
    });

    return !hasConflict;
  });
};

// --- Expenses Logic ---

export const getExpenses = async (): Promise<Expense[]> => {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.from('expenses').select('*');
    if (!error && data) return data as Expense[];
  }
  return getStoredData<Expense[]>(STORAGE_KEY_EXPENSES) || [];
};

export const addExpense = async (
  data: Omit<Expense, "id">
): Promise<Expense> => {
  const newExpense: Expense = {
    ...data,
    id: nanoid(),
    barberId: data.barberId // Include barberId in the new expense
  };

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase.from('expenses').insert(newExpense);
    if (error) throw error;
  } else {
    const expenses = await getExpenses();
    expenses.push(newExpense);
    saveData(STORAGE_KEY_EXPENSES, expenses);
  }
  
  return newExpense;
};

export const deleteExpense = async (id: string) => {
  if (isSupabaseConfigured() && supabase) {
    await supabase.from('expenses').delete().eq('id', id);
  } else {
    const expenses = await getExpenses();
    const updated = expenses.filter(e => e.id !== id);
    saveData(STORAGE_KEY_EXPENSES, updated);
  }
};
