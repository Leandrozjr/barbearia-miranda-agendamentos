import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Check, User, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { BUSINESS_CONFIG } from "@/lib/data";
import { getAvailableSlots, createAppointment, getBarbers, getServices } from "@/lib/storage";
import type { Barber, Service } from "@/types";

// --- Schema ---
const bookingSchema = z.object({
  serviceId: z.string().min(1, "Selecione um serviço"),
  barberId: z.string().min(1, "Selecione um barbeiro"),
  date: z.date(),
  time: z.string().min(1, "Selecione um horário"),
  customerName: z.string().min(3, "Nome muito curto"),
  customerPhone: z.string()
    .min(8, "Erro: O telefone precisa ter pelo menos 8 dígitos (incluindo DDD).")
    .regex(/^\d+$/, "Erro: Digite apenas números."),
  customerNote: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

const STEPS = ["Barbeiro", "Serviço", "Data & Hora", "Seus Dados", "Confirmação"];

export function BookingWizard() {
  const [step, setStep] = useState(0);
  const [slots, setSlots] = useState<string[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmedData, setConfirmedData] = useState<any>(null); // Estado seguro para renderizar sucesso
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Load barbers and services from dynamic storage
  useEffect(() => {
    getBarbers().then(setBarbers);
    getServices().then(setServices);
  }, []);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      serviceId: "",
      barberId: "",
      time: "",
      customerName: "",
      customerPhone: "",
      customerNote: "",
    },
  });

  const { watch, setValue, trigger } = form;
  const selectedServiceId = watch("serviceId");
  const selectedBarberId = watch("barberId");
  const selectedDate = watch("date");
  const selectedTime = watch("time");

  // Update slots when dependencies change
  useEffect(() => {
    if (selectedDate && selectedBarberId && selectedServiceId) {
      setIsLoadingSlots(true);
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      getAvailableSlots(dateStr, selectedBarberId, selectedServiceId).then(available => {
        setSlots(available);
        setIsLoadingSlots(false);
      });
    } else {
      setSlots([]);
    }
  }, [selectedDate, selectedBarberId, selectedServiceId]);

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedBarber = barbers.find(b => b.id === selectedBarberId);

  // --- Handlers ---

  const handleNext = async () => {
    let isValid = false;
    
    if (step === 0) isValid = await trigger("barberId");
    if (step === 1) isValid = await trigger("serviceId");
    if (step === 2) isValid = await trigger(["date", "time"]);
    if (step === 3) isValid = await trigger(["customerName", "customerPhone"]);

    if (isValid) {
      if (step === 3) {
        handleSubmit();
      } else {
        setStep(s => s + 1);
      }
    }
  };

  const handleBack = () => {
    setStep(s => Math.max(0, s - 1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setValue("date", date);
    setValue("time", ""); 
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const data = form.getValues();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await createAppointment({
        barberId: data.barberId,
        serviceId: data.serviceId,
        date: format(data.date, "yyyy-MM-dd"),
        time: data.time,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: "",
        customerNote: data.customerNote
      });

      // Salva dados para exibição segura, independente do form
      const barber = barbers.find(b => b.id === data.barberId);
      const service = services.find(s => s.id === data.serviceId);
      setConfirmedData({
        serviceName: service?.name || "Serviço",
        barberName: barber?.name || "Profissional",
        barberPhone: barber?.phone,
        barberId: data.barberId,
        date: data.date,
        time: data.time
      });

      setIsSuccess(true);
      setStep(4);
      toast.success("Agendamento confirmado!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao agendar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess && confirmedData) {
    return (
      <Card className={cn(
        "w-full max-w-2xl mx-auto rounded-none border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white animate-in fade-in zoom-in duration-500",
        confirmedData.barberId === 'barber4' && "theme-pink"
      )}>
        <CardHeader className="text-center pb-6 border-b-2 border-black bg-neutral-50">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-black">
            <Check className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl font-serif font-black uppercase tracking-tight">Confirmado!</CardTitle>
          <CardDescription className="text-black font-medium">Te esperamos na barbearia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center py-8">
          <div className="bg-white p-6 border-2 border-black space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
            <p className="font-serif text-xl font-bold uppercase">{confirmedData.serviceName}</p>
            <div className="flex flex-col gap-2 text-sm font-medium">
              <p className="flex items-center justify-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                {confirmedData.date && format(confirmedData.date, "dd 'de' MMMM", { locale: ptBR })} às {confirmedData.time}
              </p>
              <div className="flex flex-col items-center">
                <p className="flex items-center justify-center gap-2">
                  <User className="w-4 h-4" />
                  Profissional: {confirmedData.barberName}
                </p>
                {confirmedData.barberPhone && (
                  <a 
                    href={`tel:${confirmedData.barberPhone.replace(/\D/g, '')}`} 
                    className="text-blue-600 hover:text-blue-800 font-bold mt-1 text-sm underline underline-offset-4"
                  >
                    {confirmedData.barberPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                  </a>
                )}
              </div>
            </div>
          </div>
          
          {confirmedData.barberPhone && (
            <div className="pt-4 flex justify-center">
              <a 
                href={`https://wa.me/55${confirmedData.barberPhone.replace(/\D/g, '')}`} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-bold border-2 border-green-600 px-6 py-2 rounded-none hover:bg-green-50 transition-colors uppercase text-xs tracking-wider"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.07 0C5.537 0 .227 5.33.227 11.87c0 2.089.544 4.104 1.578 5.884l-1.666 6.088 6.262-1.642a11.832 11.832 0 005.671 1.45h.005c6.533 0 11.844-5.328 11.844-11.868 0-3.17-.678-5.696-1.841-8.127z"/></svg>
                Falar no WhatsApp
              </a>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-8">
          <Button onClick={() => window.location.reload()} className="rounded-none border-2 border-black bg-white text-black hover:bg-black hover:text-white uppercase font-bold tracking-wider px-8">
            Novo Agendamento
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-12 px-2 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-neutral-200 -z-10" />
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-black -z-10 transition-all duration-300"
          style={{ width: `${(step / (STEPS.length - 2)) * 100}%` }}
        />
        {STEPS.slice(0, 4).map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-2 bg-white px-2">
            <div className={cn(
              "w-10 h-10 flex items-center justify-center text-sm font-bold border-2 transition-all duration-300",
              step >= i ? "border-black bg-black text-white" : "border-neutral-300 bg-white text-neutral-400"
            )}>
              {i + 1}
            </div>
            <span className={cn(
              "text-xs font-bold uppercase tracking-wider hidden sm:block",
              step >= i ? "text-black" : "text-neutral-400"
            )}>{label}</span>
          </div>
        ))}
      </div>

      <Card className={cn(
        "rounded-none border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white transition-colors duration-500",
        selectedBarberId === 'barber4' && "theme-pink"
      )}>
        <CardHeader className="border-b-2 border-black bg-neutral-50">
          <CardTitle className="text-2xl font-serif font-black uppercase tracking-tight">
            {step === 0 && "Escolha o Profissional"}
            {step === 1 && "Selecione o Serviço"}
            {step === 2 && "Escolha Data e Horário"}
            {step === 3 && "Finalizar Agendamento"}
          </CardTitle>
        </CardHeader>

        <CardContent className="min-h-[300px] py-8">
          <Form {...form}>
            <form className="space-y-6">
              
              {/* STEP 0: BARBER */}
              {step === 0 && (
                <FormField
                  control={form.control}
                  name="barberId"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {barbers.map((barber) => (
                          <div key={barber.id}>
                            <input
                              type="radio"
                              id={barber.id}
                              className="peer sr-only"
                              value={barber.id}
                              checked={field.value === barber.id}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                            <Label
                              htmlFor={barber.id}
                              className="flex items-center gap-4 p-4 border-2 border-neutral-200 cursor-pointer hover:border-black transition-all peer-checked:border-black peer-checked:bg-black peer-checked:text-white group"
                            >
                              <div className="w-14 h-14 overflow-hidden border-2 border-black bg-white group-peer-checked:border-white">
                                <img src={barber.avatarUrl} alt={barber.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-serif text-xl font-bold uppercase">{barber.name}</span>
                                <span className="text-sm text-muted-foreground group-peer-checked:text-neutral-300">Profissional</span>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* STEP 1: SERVICE */}
              {step === 1 && (
                <FormField
                  control={form.control}
                  name="serviceId"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {services
                          .filter(service => selectedBarber?.serviceIds?.includes(service.id))
                          .map((service) => (
                            <div key={service.id}>
                              <input
                                type="radio"
                                id={service.id}
                                className="peer sr-only"
                                value={service.id}
                                checked={field.value === service.id}
                                onChange={(e) => field.onChange(e.target.value)}
                              />
                              <Label
                                htmlFor={service.id}
                                className="flex flex-col p-6 border-2 border-neutral-200 cursor-pointer hover:border-black transition-all peer-checked:border-black peer-checked:bg-black peer-checked:text-white h-full group"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-serif text-lg font-bold uppercase">{service.name}</span>
                                  <span className="font-bold text-accent group-peer-checked:text-white">R$ {service.price}</span>
                                </div>
                                <div className="flex items-center text-sm text-muted-foreground gap-2 group-peer-checked:text-neutral-300">
                                  <Clock className="w-4 h-4" />
                                  {service.durationMinutes} min
                                </div>
                              </Label>
                            </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* STEP 2: DATE & TIME */}
              {step === 2 && (
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="font-bold uppercase text-xs tracking-wider mb-2">Selecione a Data</FormLabel>
                          <div className="border-2 border-black p-2">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={handleDateSelect}
                              disabled={(date) => 
                                date < new Date(new Date().setHours(0,0,0,0)) || 
                                !BUSINESS_CONFIG.daysOpen.includes(date.getDay())
                              }
                              className="w-full"
                              locale={ptBR}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold uppercase text-xs tracking-wider mb-2">
                            Horários Disponíveis {selectedDate && `(${format(selectedDate, "dd/MM", {locale: ptBR})})`}
                          </FormLabel>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {isLoadingSlots ? (
                              <div className="col-span-3 flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-black" />
                              </div>
                            ) : !selectedDate ? (
                              <div className="col-span-3 text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-neutral-300 p-4">
                                Selecione uma data primeiro
                              </div>
                            ) : slots.length === 0 ? (
                              <div className="col-span-3 text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-neutral-300 p-4">
                                Nenhum horário disponível.
                              </div>
                            ) : (
                              slots.map((slot) => (
                                <div key={slot}>
                                  <input
                                    type="radio"
                                    id={`slot-${slot}`}
                                    className="peer sr-only"
                                    value={slot}
                                    checked={field.value === slot}
                                    onChange={(e) => field.onChange(e.target.value)}
                                  />
                                  <Label
                                    htmlFor={`slot-${slot}`}
                                    className="flex items-center justify-center p-2 border-2 border-neutral-200 cursor-pointer hover:border-black hover:bg-neutral-100 transition-all peer-checked:bg-black peer-checked:text-white peer-checked:border-black font-bold text-sm"
                                  >
                                    {slot}
                                  </Label>
                                </div>
                              ))
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: CUSTOMER DATA */}
              {step === 3 && (
                <div className="space-y-6 max-w-md mx-auto">
                  <div className="bg-neutral-50 p-6 border-2 border-black space-y-4">
                    <h4 className="font-serif font-black uppercase text-lg border-b-2 border-black pb-2 mb-2">Resumo</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Serviço:</span>
                        <span className="font-bold">{selectedService?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor:</span>
                        <span className="font-bold text-accent">R$ {selectedService?.price}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Profissional:</span>
                        <span className="font-bold">{selectedBarber?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Data/Hora:</span>
                        <span className="font-bold bg-black text-white px-2">
                          {selectedDate && format(selectedDate, "dd/MM/yyyy")} às {selectedTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold uppercase text-xs tracking-wider">Seu Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Leandro Miranda" {...field} className="rounded-none border-2 border-black h-12 focus-visible:ring-0 focus-visible:bg-neutral-50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold uppercase text-xs tracking-wider">Celular (WhatsApp)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(XX) 99999-9999" 
                            type="tel" 
                            {...field} 
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, "");
                              field.onChange(value);
                            }}
                            className="rounded-none border-2 border-black h-12 focus-visible:ring-0 focus-visible:bg-neutral-50" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold uppercase text-xs tracking-wider">Observação (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Ex: Tenho alergia a lâmina, prefiro tesoura..." 
                            className="rounded-none border-2 border-black min-h-[100px] focus-visible:ring-0 focus-visible:bg-neutral-50 resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="flex justify-between border-t-2 border-black p-6 bg-neutral-50">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={step === 0 || isSubmitting}
            className="gap-2 rounded-none border-2 border-black bg-white hover:bg-neutral-100 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
          
          <Button 
            onClick={handleNext} 
            disabled={isSubmitting}
            className="gap-2 bg-black hover:bg-neutral-800 text-white font-bold px-8 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all uppercase tracking-widest"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Agendando...
              </>
            ) : step === 3 ? (
              <>Confirmar <Check className="w-4 h-4" /></>
            ) : (
              <>Próximo <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
