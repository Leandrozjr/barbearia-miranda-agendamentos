export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface Barber {
  id: string;
  name: string;
  serviceIds: string[]; // IDs dos serviços que ele realiza
  avatarUrl?: string;
  phone?: string;
  openTime?: string; // Optional override for specific barber
  closeTime?: string; // Optional override for specific barber
}

export interface Appointment {
  id: string;
  barberId: string;
  serviceId: string;
  date: string; // ISO String YYYY-MM-DD
  time: string; // HH:mm
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerNote?: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'blocked';
  createdAt: string;
}

export interface BusinessConfig {
  name: string;
  city: string;
  phone: string;
  openTime: string; // "09:00"
  closeTime: string; // "19:00"
  daysOpen: number[]; // 0=Dom, 1=Seg, ..., 6=Sab
  slotInterval: number; // minutos
  currency: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'marketing' | 'material' | 'fixed' | 'other';
  date: string; // ISO YYYY-MM-DD
  barberId?: string; // ID do barbeiro que registrou a despesa (opcional para gerente)
}
