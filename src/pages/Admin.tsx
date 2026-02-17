import { useState, useEffect } from "react";
import { format, parseISO, isToday, compareAsc } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Search, RefreshCw, LogOut, Calendar as CalendarIcon, Link as LinkIcon, CheckCircle2, ArrowLeft, User, Lock, Save, Upload, Database, WifiOff, DollarSign, Clock, Ban, MessageSquare, Phone, MessageCircle, CheckCircle, Plus, Check, Settings, AlertTriangle, LayoutTemplate, Image as ImageIcon, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { Link } from "wouter";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Textarea } from "@/components/ui/textarea";

import { getAppointments, cancelAppointment, clearAppointments, getUsers, updateUser, getBarbers, type AdminUser, createAppointment, completeAppointment, getServices, updateServicePrice, addService, deleteService, updateBarberSchedule, updateBarberServices } from "@/lib/storage";
import { logger, type LogEntry } from "@/lib/logger";
import { fetchSiteContent, updateSiteContent, fetchGallery, addGalleryItem, deleteGalleryItem, uploadGalleryImage, type SiteContent, type GalleryItem, defaultContent } from "@/lib/contentManager";

// Supabase Auth (needed to write to DB/Storage when RLS uses `authenticated`)
import type { Appointment, Service } from "@/types";
import { HIDDEN_SERVICES } from "@/lib/data";
import { FinancialDashboard } from "@/components/FinancialDashboard";

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState("appointments"); // appointments, profile
  const [appointmentFilter, setAppointmentFilter] = useState("upcoming"); // upcoming, today, all
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Content Management State
  const [siteContent, setSiteContent] = useState<SiteContent>(defaultContent);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageCaption, setNewImageCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Supabase Auth State (required for saving content/upload when RLS uses `authenticated`)
  const [sbEmail, setSbEmail] = useState("");
  const [sbPassword, setSbPassword] = useState("");
  const [sbAuthed, setSbAuthed] = useState(false);

  // Service Management State
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("30");
  const [newServiceBarberId, setNewServiceBarberId] = useState("all");

  // Schedule Management State
  const [editingScheduleBarberId, setEditingScheduleBarberId] = useState("");
  const [scheduleOpenTime, setScheduleOpenTime] = useState("");
  const [scheduleCloseTime, setScheduleCloseTime] = useState("");

  const [googleConnected, setGoogleConnected] = useState(false);

  // Profile Form State
  const [profileName, setProfileName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profilePassword, setProfilePassword] = useState("");

  // Block Form State
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState("");
  const [blockDurationId, setBlockDurationId] = useState("block-60");
  const [blockNote, setBlockNote] = useState("");
  const [blockBarberId, setBlockBarberId] = useState("");

  useEffect(() => {
    if (currentUser) {
      setBlockBarberId(currentUser.id);
    }
  }, [currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // Limit 500KB due to localStorage limits
        toast.error("A imagem é muito grande. Tente uma menor que 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileAvatar(reader.result as string);
        toast.success("Foto carregada com sucesso!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = await requireSupabaseAuth();
    if (!ok) return;

    if (file.size > 2000000) { // Limit 2MB for gallery uploads
      toast.error("Imagem muito grande (máx 2MB).");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadGalleryImage(file);
      if (url) {
        setNewImageUrl(url);
        toast.success("Imagem enviada! Agora clique em 'Salvar na Galeria'.");
      } else {
        toast.error("Upload falhou. Confirme bucket 'gallery' + policies (Storage) no Supabase.");
      }
    } catch (err: any) {
      toast.error("Falha no upload: " + (err?.message || "Erro desconhecido"));
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    // Load users and services on mount for login screen
    const initUsers = async () => {
      const loadedUsers = await getUsers();
      setUsers(loadedUsers);
      
      const loadedServices = await getServices();
      setServices(loadedServices);

      const authUser = sessionStorage.getItem("admin_user");
      if (authUser) {
        const user = JSON.parse(authUser);
        const freshUser = loadedUsers.find(u => u.id === user.id) || user;
        setCurrentUser(freshUser);
        setIsAuthenticated(true);
        
        setProfileName(freshUser.name);
        setProfileAvatar(freshUser.avatarUrl || "");
        setProfilePassword(freshUser.password || "");

        const gConn = localStorage.getItem(`google_conn_${user.id}`);
        if (gConn === "true") setGoogleConnected(true);
      }
    };
    initUsers();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAppointments(false);
      loadContent();

      // Configurar Realtime
      let channel: any = null;

      // 1. Supabase (Online)
      if (isSupabaseConfigured() && supabase) {
        channel = supabase
          .channel('appointments-changes')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'appointments' },
            () => {
              toast.message("Nova atualização na agenda!", {
                description: "Os dados foram atualizados automaticamente."
              });
              loadAppointments(false);
            }
          )
          .subscribe();
      }

      // 2. Local Storage (Offline - entre abas)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === "barbearia_appointments") {
          loadAppointments(false);
        }
      };
      window.addEventListener('storage', handleStorageChange);

      return () => {
        if (channel && supabase) supabase.removeChannel(channel);
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, [isAuthenticated, currentUser]);

  const refreshSupabaseSession = async () => {
    try {
      if (!supabase) {
        setSbAuthed(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      setSbAuthed(!!data.session);
    } catch {
      setSbAuthed(false);
    }
  };

  const loadContent = async () => {
    if (currentUser?.isMaster) {
      await refreshSupabaseSession();
      const content = await fetchSiteContent();
      setSiteContent(content);
      const galleryItems = await fetchGallery();
      setGallery(galleryItems);
    }
  };

  const requireSupabaseAuth = async (): Promise<boolean> => {
    if (!supabase) {
      toast.error("Supabase não está configurado no site oficial.");
      return false;
    }

    const { data } = await supabase.auth.getSession();
    const authed = !!data.session;
    setSbAuthed(authed);

    if (!authed) {
      toast.error("Conecte o Supabase (login) para salvar no site oficial.");
      return false;
    }

    return true;
  };

  const handleSupabaseLogin = async () => {
    if (!supabase) {
      toast.error("Supabase não está configurado.");
      return;
    }
    if (!sbEmail || !sbPassword) {
      toast.error("Preencha email e senha do Supabase.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: sbEmail, password: sbPassword });
    if (error) {
      toast.error("Login Supabase falhou: " + error.message);
      setSbAuthed(false);
      return;
    }

    toast.success("Supabase conectado! Agora você pode salvar e enviar fotos.");
    await refreshSupabaseSession();
  };

  const handleSupabaseLogout = async () => {
    try {
      if (!supabase) return;
      await supabase.auth.signOut();
      setSbAuthed(false);
      toast.success("Supabase desconectado.");
    } catch {
      // ignore
    }
  };

  const handleSaveContent = async () => {
    const ok = await requireSupabaseAuth();
    if (!ok) return;

    const res = await updateSiteContent(siteContent);
    if (res.success) {
      toast.success("Conteúdo do site atualizado!");
    } else {
      toast.error("Erro ao salvar: " + res.error);
    }
  };

  const handleAddGalleryImage = async () => {
    const ok = await requireSupabaseAuth();
    if (!ok) return;

    if (!newImageUrl) {
      toast.error("Insira a URL da imagem");
      return;
    }

    const success = await addGalleryItem(newImageUrl, newImageCaption);
    if (success) {
      setNewImageUrl("");
      setNewImageCaption("");
      const items = await fetchGallery();
      setGallery(items);
      toast.success("Imagem adicionada!");
    } else {
      toast.error("Erro ao adicionar imagem.");
    }
  };

  const handleDeleteGalleryImage = async (id: string) => {
    if (confirm("Remover esta imagem?")) {
        const success = await deleteGalleryItem(id);
        if (success) {
            const items = await fetchGallery();
            setGallery(items);
            toast.success("Imagem removida.");
        }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentUsers = await getUsers();
    const user = currentUsers.find(u => u.id === loginId);
    
    if (user && user.password === password) {
      sessionStorage.setItem("admin_user", JSON.stringify(user));
      setCurrentUser(user);
      setIsAuthenticated(true);
      
      setProfileName(user.name);
      setProfileAvatar(user.avatarUrl || "");
      setProfilePassword(user.password || "");

      const gConn = localStorage.getItem(`google_conn_${user.id}`);
      setGoogleConnected(gConn === "true");
      
      toast.success(`Bem-vindo, ${user.name}!`);
    } else {
      toast.error("Usuário ou senha inválidos");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_user");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAppointments([]);
    setPassword("");
    setLoginId("");
    setActiveTab("appointments");
  };

  const handleBlockSlot = async () => {
    if (!blockDate || !blockTime) {
      toast.error("Selecione data e hora.");
      return;
    }

    if (!blockBarberId) {
      toast.error("Selecione um profissional.");
      return;
    }

    try {
      await createAppointment({
        barberId: blockBarberId,
        serviceId: blockDurationId,
        date: blockDate,
        time: blockTime,
        customerName: blockNote || "Horário Bloqueado",
        customerPhone: "00000000",
        customerEmail: "",
      });
      
      toast.success("Horário bloqueado com sucesso!");
      setIsBlockDialogOpen(false);
      setBlockNote("");
      loadAppointments(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao bloquear horário.");
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    if (!profileName.trim()) {
      toast.error("Nome não pode ficar vazio");
      return;
    }
    if (!profilePassword.trim()) {
      toast.error("Senha não pode ficar vazia");
      return;
    }

    const updatedUser: AdminUser = {
      ...currentUser,
      name: profileName,
      avatarUrl: profileAvatar,
      password: profilePassword
    };

    await updateUser(updatedUser);
    setCurrentUser(updatedUser);
    sessionStorage.setItem("admin_user", JSON.stringify(updatedUser));
    
    toast.success("Perfil atualizado com sucesso!");
    loadAppointments(false);
  };

  const connectGoogle = () => {
    if (!currentUser) return;
    
    toast.loading("Conectando ao Google...");
    setTimeout(() => {
      setGoogleConnected(true);
      localStorage.setItem(`google_conn_${currentUser.id}`, "true");
      toast.dismiss();
      toast.success("Agenda Google sincronizada com sucesso!");
    }, 1500);
  };

  const loadAppointments = async (showFeedback = false) => {
    setIsRefreshing(true);
    try {
      const data = await getAppointments();
      
      let filtered = data;
      if (currentUser && !currentUser.isMaster) {
        filtered = data.filter(app => app.barberId === currentUser.id);
      }

      filtered.sort((a, b) => {
        // Safety check for missing dates
        if (!a.date || !a.time) return 1;
        if (!b.date || !b.time) return -1;
        try {
            const dateA = parseISO(`${a.date}T${a.time}`);
            const dateB = parseISO(`${b.date}T${b.time}`);
            return compareAsc(dateA, dateB);
        } catch (e) {
            return 0; // Fallback for invalid dates
        }
      });
      setAppointments(filtered);
      if (showFeedback) toast.success("Lista atualizada com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar lista.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (window.confirm("Tem certeza que deseja cancelar este agendamento?")) {
      await cancelAppointment(id);
      loadAppointments(false);
      toast.success("Agendamento cancelado");
    }
  };

  const handleComplete = async (id: string) => {
    if (window.confirm("Marcar atendimento como concluído?")) {
      await completeAppointment(id);
      loadAppointments(false);
      toast.success("Atendimento concluído!");
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm("ATENÇÃO: Isso apagará TODOS os agendamentos do sistema permanentemente.\n\nTem certeza que deseja continuar?")) {
      await clearAppointments();
      loadAppointments(false);
      toast.success("Histórico apagado com sucesso.");
    }
  };

  const addToGoogleCalendar = (app: Appointment) => {
    const serviceName = services.find(s => s.id === app.serviceId)?.name || "Serviço";
    const startTime = `${app.date.replace(/-/g, '')}T${app.time.replace(':', '')}00`;
    const endTime = `${app.date.replace(/-/g, '')}T${(parseInt(app.time.split(':')[0]) + 1).toString().padStart(2, '0')}${app.time.split(':')[1]}00`;
    
    const details = `Cliente: ${app.customerName} - Tel: ${app.customerPhone}`;
    const title = `${serviceName} - ${app.customerName} (${app.customerPhone})`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(details)}&location=Estudio%203M`;
    
    window.open(url, '_blank');
  };

  const confirmViaWhatsApp = (app: Appointment) => {
    const message = `Olá ${app.customerName}, aqui é do Estúdio 3M. Confirmando seu agendamento para ${format(parseISO(app.date), "dd/MM")} às ${app.time}. Tudo certo?`;
    const url = `https://wa.me/55${app.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Helpers to get dynamic names
  const [barbers, setBarbers] = useState<any[]>([]);
  useEffect(() => { getBarbers().then(setBarbers); }, []);
  const getBarberName = (id: string) => barbers.find(b => b.id === id)?.name || id;
  const getServiceName = (id: string) => [...services, ...HIDDEN_SERVICES].find(s => s.id === id)?.name || id;

  const handlePriceUpdate = async (id: string) => {
    const newPrice = parseFloat(tempPrice);
    if (isNaN(newPrice) || newPrice < 0) {
        toast.error("Valor inválido");
        return;
    }
    
    await updateServicePrice(id, newPrice);
    const updated = await getServices();
    setServices(updated);
    setEditingPriceId(null);
    toast.success("Preço atualizado!");
  };

  const handleAddService = async () => {
    if (!newServiceName || !newServicePrice) {
        toast.error("Preencha nome e preço");
        return;
    }
    const id = "s-" + Date.now();
    await addService({
        id,
        name: newServiceName,
        price: parseFloat(newServicePrice),
        durationMinutes: parseInt(newServiceDuration)
    });

    // Assign service to barbers
    if (newServiceBarberId === "all") {
        for (const barber of barbers) {
             const currentServices = barber.serviceIds || [];
             if (!currentServices.includes(id)) {
                 await updateBarberServices(barber.id, [...currentServices, id]);
             }
        }
    } else {
        const barber = barbers.find(b => b.id === newServiceBarberId);
        if (barber) {
            const currentServices = barber.serviceIds || [];
            await updateBarberServices(barber.id, [...currentServices, id]);
        }
    }

    setNewServiceName("");
    setNewServicePrice("");
    setNewServiceBarberId("all");
    
    const updatedServices = await getServices();
    setServices(updatedServices);
    
    const updatedBarbers = await getBarbers();
    setBarbers(updatedBarbers);

    toast.success("Serviço adicionado!");
  };

  const handleDeleteService = async (id: string) => {
    if (confirm("Tem certeza? Isso pode afetar agendamentos passados.")) {
        await deleteService(id);
        const updated = await getServices();
        setServices(updated);
        toast.success("Serviço removido.");
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingScheduleBarberId || !scheduleOpenTime || !scheduleCloseTime) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      await updateBarberSchedule(editingScheduleBarberId, scheduleOpenTime, scheduleCloseTime);
      toast.success("Horário atualizado com sucesso!");
      const updatedBarbers = await getBarbers();
      setBarbers(updatedBarbers);
    } catch (err: any) {
      toast.error("Não foi possível salvar no Supabase: " + (err?.message || "Erro desconhecido"));
    }
  };

  const loadLogs = async () => {
    if (currentUser?.isMaster) {
        const systemLogs = await logger.getSystemLogs();
        setLogs(systemLogs);
    }
  };

  const handleClearLogs = async () => {
    if (confirm("Tem certeza que deseja limpar os logs?")) {
        await logger.clearLogs();
        loadLogs();
        toast.success("Logs limpos.");
    }
  };

  useEffect(() => {
    if (activeTab === 'logs') {
        loadLogs();
    }
    if (activeTab === 'content') {
        loadContent();
    }
  }, [activeTab]);

  const filteredAppointments = appointments.filter(app => {
    const matchesSearch = 
      app.customerName.toLowerCase().includes(search.toLowerCase()) ||
      app.customerPhone.includes(search);
    
    if (!matchesSearch) return false;

    const appDate = parseISO(app.date);
    if (appointmentFilter === "today") return isToday(appDate);
    if (appointmentFilter === "upcoming") {
        const now = new Date();
        now.setHours(0,0,0,0);
        return compareAsc(appDate, now) >= 0;
    }
    return true;
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-t-4 border-t-accent shadow-xl">
          <CardHeader>
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <CalendarIcon className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-center text-2xl">Acesso Profissional</CardTitle>
            <CardDescription className="text-center">
              Selecione seu perfil para acessar sua agenda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Quem é você?</label>
                <Select onValueChange={setLoginId} value={loginId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} {user.isMaster ? "(Gerente)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Senha</label>
                <Input 
                  type="password" 
                  placeholder="Digite sua senha..." 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                />
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={!loginId}>
                Acessar Agenda
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 justify-center border-t pt-4">
            <Link href="/">
              <a className="text-sm text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Voltar ao Início
              </a>
            </Link>
            <p className="text-xs text-muted-foreground">Sistema Estudio 3M v1.2</p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Header />
      <main className="container mx-auto p-4 pt-24 max-w-6xl">
        
        {/* Admin Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-card p-6 rounded-lg border shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">Olá, {currentUser?.name}</h1>
              {currentUser?.isMaster && <Badge variant="secondary">Gerente</Badge>}
              
              {isSupabaseConfigured() ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 ml-2">
                  <Database className="w-3 h-3" /> Online
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 ml-2" title="Rodando localmente. Configure o Supabase para sincronizar.">
                  <WifiOff className="w-3 h-3" /> Modo Local (Demo)
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {currentUser?.isMaster 
                ? "Visão geral de todas as agendas." 
                : "Gerencie seus horários e clientes."}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 w-full sm:w-auto">
             {activeTab === "appointments" && (
                <Button 
                  variant={googleConnected ? "outline" : "default"}
                  className={googleConnected 
                    ? "border-green-500/50 text-green-600 hover:text-green-700 bg-green-50/50" 
                    : "bg-blue-600 hover:bg-blue-700 text-white"}
                  onClick={connectGoogle}
                  disabled={googleConnected}
                >
                  {googleConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Sincronizado
                    </>
                  ) : (
                    <>
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      Conectar Google
                    </>
                  )}
                </Button>
             )}

            <div className="h-6 w-px bg-border hidden sm:block" />

            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <LogOut className="w-4 h-4 mr-2"/> Sair
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 md:grid-cols-5 h-auto md:h-10 gap-1">
            <TabsTrigger value="appointments" className="gap-2">
              <CalendarIcon className="w-4 h-4" /> <span className="hidden md:inline">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="w-4 h-4" /> <span className="hidden md:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" /> <span className="hidden md:inline">Perfil</span>
            </TabsTrigger>
            {currentUser?.isMaster && (
                <TabsTrigger 
                    value="settings" 
                    className="gap-2 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 border-l border-transparent data-[state=active]:border-amber-200"
                >
                <Settings className="w-4 h-4" /> <span className="hidden md:inline">Config</span>
                </TabsTrigger>
            )}
            {currentUser?.isMaster && (
                <TabsTrigger 
                    value="content" 
                    className="gap-2 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900 border-l border-transparent data-[state=active]:border-purple-200"
                >
                <LayoutTemplate className="w-4 h-4" /> <span className="hidden md:inline">Site</span>
                </TabsTrigger>
            )}
          </TabsList>
          
          <div className="md:hidden flex gap-2 overflow-x-auto pb-2 px-1">
             {currentUser?.isMaster && (
                 <>
                    <Button 
                        size="sm" variant={activeTab === 'logs' ? 'secondary' : 'ghost'} 
                        onClick={() => setActiveTab('logs')}
                        className={activeTab === 'logs' ? "bg-red-50 text-red-900" : ""}
                    >
                        Logs
                    </Button>
                    <Button 
                        size="sm" variant={activeTab === 'content' ? 'secondary' : 'ghost'} 
                        onClick={() => setActiveTab('content')}
                        className={activeTab === 'content' ? "bg-purple-50 text-purple-900" : ""}
                    >
                        Site
                    </Button>
                 </>
             )}
          </div>

          {/* APPOINTMENTS TAB */}
          <TabsContent value="appointments" className="space-y-6 pb-40">
            {/* ... Existing Appointments Content ... */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar cliente ou telefone..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <Tabs value={appointmentFilter} onValueChange={setAppointmentFilter} className="w-auto">
                <TabsList>
                    <TabsTrigger value="upcoming">Próximos</TabsTrigger>
                    <TabsTrigger value="today">Hoje</TabsTrigger>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex gap-2 self-end sm:self-auto">
                <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" className="flex bg-amber-100 text-amber-900 hover:bg-amber-200 border-amber-200 border">
                      <Ban className="w-4 h-4 mr-2"/> Bloquear Horário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Bloquear Horário (Folga/Almoço)</DialogTitle>
                      <DialogDescription>
                        Isso impedirá que clientes agendem neste período.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {currentUser?.isMaster && (
                        <div className="space-y-2">
                          <Label>Profissional</Label>
                          <Select value={blockBarberId} onValueChange={setBlockBarberId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o barbeiro" />
                            </SelectTrigger>
                            <SelectContent>
                              {barbers.map(b => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Data</Label>
                          <Input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Hora Início</Label>
                          <Input type="time" value={blockTime} onChange={e => setBlockTime(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Duração do Bloqueio</Label>
                        <Select value={blockDurationId} onValueChange={setBlockDurationId}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {HIDDEN_SERVICES.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Motivo (Opcional)</Label>
                        <Input placeholder="Ex: Almoço, Médico..." value={blockNote} onChange={e => setBlockNote(e.target.value)} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleBlockSlot}>Confirmar Bloqueio</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {currentUser?.isMaster && (
                  <Button variant="destructive" size="sm" onClick={handleClearHistory} className="flex">
                    <Trash2 className="w-4 h-4 mr-2"/> Limpar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => loadAppointments(true)} disabled={isRefreshing} className="flex">
                  {isRefreshing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin"/> : <RefreshCw className="w-4 h-4 mr-2"/>}
                  Atualizar
                </Button>
              </div>
            </div>

            <Card className="border-none shadow-md">
              <CardHeader className="pb-3 border-b">
                <CardTitle>Lista de Agendamentos</CardTitle>
                <CardDescription>
                    {filteredAppointments.length} horários encontrados.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <>
                  {/* Mobile Cards View */}
                  <div className="md:hidden space-y-4 p-4 bg-muted/10">
                    {filteredAppointments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum agendamento encontrado.
                      </div>
                    ) : (
                      filteredAppointments.map((app) => (
                        <Card key={app.id} className="border shadow-sm overflow-hidden">
                          <div className={`h-2 w-full ${
                            app.status === 'confirmed' ? 'bg-green-500' : 
                            app.status === 'cancelled' ? 'bg-red-500' : 
                            app.status === 'blocked' ? 'bg-gray-400' : 'bg-blue-500'
                          }`} />
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="text-2xl font-bold text-foreground font-serif">
                                  {app.time}
                                </span>
                                <span className="text-sm text-muted-foreground capitalize">
                                  {format(parseISO(app.date), "EEEE, dd MMM", { locale: ptBR })}
                                </span>
                              </div>
                              <Badge variant={
                                app.status === 'confirmed' ? 'default' : 
                                app.status === 'cancelled' ? 'destructive' : 
                                app.status === 'blocked' ? 'secondary' : 'outline'
                              }>
                                {app.status === 'confirmed' ? 'Confirmado' : 
                                  app.status === 'cancelled' ? 'Cancelado' : 
                                  app.status === 'blocked' ? 'Bloqueado' : 'Concluído'}
                              </Badge>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-bold">{app.customerName}</span>
                                {app.customerNote && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500">
                                        <MessageSquare className="w-5 h-5" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-4">
                                      <p className="font-bold mb-1 text-sm">Nota do Cliente:</p>
                                      <p className="text-sm">{app.customerNote}</p>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <a href={`https://wa.me/55${app.customerPhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline font-medium">
                                  {app.customerPhone}
                                </a>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <Badge variant="outline" className="text-xs bg-background">
                                  {getServiceName(app.serviceId)}
                                </Badge>
                                {currentUser?.isMaster && (
                                  <Badge variant="secondary" className="text-xs">
                                    Prof: {getBarberName(app.barberId)}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                          
                          {(app.status === 'confirmed' || app.status === 'blocked') && (
                            <div className="bg-muted/30 p-3 grid grid-cols-2 gap-2 border-t">
                              {app.status === 'confirmed' && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    className="flex-1 gap-2 border-green-200 text-green-700 hover:bg-green-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      confirmViaWhatsApp(app);
                                    }}
                                  >
                                    <MessageCircle className="w-4 h-4" /> Confirmar
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    className="flex-1 gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToGoogleCalendar(app);
                                    }}
                                  >
                                    <LinkIcon className="w-4 h-4" /> Agenda
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    className="flex-1 gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleComplete(app.id);
                                    }}
                                  >
                                    <CheckCircle className="w-4 h-4" /> Concluir
                                  </Button>
                                </>
                              )}
                              <Button 
                                variant="outline" 
                                className="flex-1 gap-2 border-red-200 text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancel(app.id);
                                }}
                              >
                                {app.status === 'blocked' ? <Ban className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                {app.status === 'blocked' ? "Desbloquear" : "Cancelar"}
                              </Button>
                            </div>
                          )}
                        </Card>
                      ))
                    )}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block rounded-none border-0 overflow-x-auto">
                    <Table className="min-w-[600px]">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Serviço</TableHead>
                          {currentUser?.isMaster && <TableHead>Profissional</TableHead>}
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAppointments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                              Nenhum agendamento encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAppointments.map((app) => (
                            <TableRow key={app.id} className="hover:bg-muted/5">
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span className="text-base font-bold text-foreground">
                                    {app.time}
                                  </span>
                                  <span className="text-xs text-muted-foreground capitalize">
                                    {format(parseISO(app.date), "dd MMM, EEEE", { locale: ptBR })}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{app.customerName}</span>
                                    {app.customerNote && (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-transparent">
                                            <MessageSquare className="w-4 h-4 text-blue-500 cursor-pointer" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="max-w-[300px] p-4 bg-white border border-border shadow-lg z-50">
                                          <p className="font-bold mb-1">Observação do Cliente:</p>
                                          <p className="text-sm text-muted-foreground">{app.customerNote}</p>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  </div>
                                  <a href={`https://wa.me/55${app.customerPhone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="text-sm text-green-600 hover:underline flex items-center gap-1 font-medium">
                                    {app.customerPhone}
                                  </a>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-normal">
                                  {getServiceName(app.serviceId)}
                                </Badge>
                              </TableCell>
                              {currentUser?.isMaster && (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">{getBarberName(app.barberId)}</span>
                                  </div>
                                </TableCell>
                              )}
                              <TableCell>
                                <Badge variant={
                                  app.status === 'confirmed' ? 'default' : 
                                  app.status === 'cancelled' ? 'destructive' : 
                                  app.status === 'blocked' ? 'secondary' : 'outline'
                                } className={app.status === 'blocked' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : ''}>
                                  {app.status === 'confirmed' ? 'Confirmado' : 
                                    app.status === 'cancelled' ? 'Cancelado' : 
                                    app.status === 'blocked' ? 'Bloqueado' : 'Concluído'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {(app.status === 'confirmed' || app.status === 'blocked') && (
                                    <>
                                      {app.status === 'confirmed' && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              confirmViaWhatsApp(app);
                                            }}
                                            title="Confirmar via WhatsApp"
                                          >
                                            <MessageCircle className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              addToGoogleCalendar(app);
                                            }}
                                            title="Adicionar ao Google Agenda"
                                          >
                                            <LinkIcon className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8 p-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleComplete(app.id);
                                            }}
                                            title="Marcar como Concluído"
                                          >
                                            <CheckCircle className="w-4 h-4" />
                                          </Button>
                                        </>
                                      )}
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCancel(app.id);
                                        }}
                                        title={app.status === 'blocked' ? "Desbloquear" : "Cancelar"}
                                      >
                                        {app.status === 'blocked' ? <Ban className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FINANCIAL TAB */}
          <TabsContent value="financial" className="pb-40">
            {currentUser && <FinancialDashboard appointments={appointments} currentUser={currentUser} />}
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="pb-40 space-y-8">
             {/* 1. SERVICES MANAGEMENT */}
             <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                        <div>
                            <CardTitle>Serviços e Preços</CardTitle>
                            <CardDescription>Gerencie os serviços oferecidos e seus valores.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Add Service Form */}
                    <div className="bg-muted/30 p-4 rounded-lg border mb-6">
                        <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Adicionar Novo Serviço
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="space-y-1 md:col-span-2">
                                <Label className="text-xs">Nome do Serviço</Label>
                                <Input 
                                    placeholder="Ex: Corte + Hidratação" 
                                    value={newServiceName}
                                    onChange={e => setNewServiceName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Preço (R$)</Label>
                                <Input 
                                    type="number" 
                                    placeholder="0.00" 
                                    value={newServicePrice}
                                    onChange={e => setNewServicePrice(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Duração (min)</Label>
                                <Select value={newServiceDuration} onValueChange={setNewServiceDuration}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="15">15 min</SelectItem>
                                        <SelectItem value="20">20 min</SelectItem>
                                        <SelectItem value="30">30 min</SelectItem>
                                        <SelectItem value="45">45 min</SelectItem>
                                        <SelectItem value="60">1 hora</SelectItem>
                                        <SelectItem value="90">1h 30m</SelectItem>
                                        <SelectItem value="120">2 horas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1 md:col-span-4">
                                <Label className="text-xs">Atribuir a (Quem faz este serviço?)</Label>
                                <Select value={newServiceBarberId} onValueChange={setNewServiceBarberId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os Profissionais</SelectItem>
                                        {barbers.map(b => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleAddService} className="w-full md:col-span-4">Adicionar Serviço</Button>
                        </div>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Serviço</TableHead>
                                    <TableHead>Duração</TableHead>
                                    <TableHead>Preço</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {services.map(service => (
                                    <TableRow key={service.id}>
                                        <TableCell className="font-medium">{service.name}</TableCell>
                                        <TableCell className="text-muted-foreground">{service.durationMinutes} min</TableCell>
                                        <TableCell>
                                            {editingPriceId === service.id ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">R$</span>
                                                    <Input 
                                                        type="number" 
                                                        value={tempPrice} 
                                                        onChange={e => setTempPrice(e.target.value)} 
                                                        className="w-20 h-8"
                                                        autoFocus
                                                    />
                                                </div>
                                            ) : (
                                                `R$ ${service.price.toFixed(2)}`
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {editingPriceId === service.id ? (
                                                    <>
                                                        <Button size="icon" variant="default" onClick={() => handlePriceUpdate(service.id)} className="h-8 w-8 bg-green-600 hover:bg-green-700">
                                                            <Check className="w-4 h-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" onClick={() => setEditingPriceId(null)} className="h-8 w-8">
                                                            <LogOut className="w-4 h-4 rotate-180" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className="h-8 w-8"
                                                            onClick={() => {
                                                                setEditingPriceId(service.id);
                                                                setTempPrice(service.price.toString());
                                                            }}
                                                            title="Editar Preço"
                                                        >
                                                            <DollarSign className="w-4 h-4" />
                                                        </Button>
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10 border-destructive/20"
                                                            onClick={() => handleDeleteService(service.id)}
                                                            title="Excluir Serviço"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
             </Card>

             {/* 2. SCHEDULE MANAGEMENT */}
             <Card>
                <CardHeader>
                    <CardTitle>Horários de Funcionamento</CardTitle>
                    <CardDescription>Defina o horário de início e fim individual para cada profissional.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {barbers.map(barber => (
                            <div key={barber.id} className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-muted overflow-hidden border">
                                        <img src={barber.avatarUrl} className="w-full h-full object-cover" alt={barber.name} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{barber.name}</h4>
                                        <p className="text-xs text-muted-foreground">Profissional</p>
                                    </div>
                                </div>
                                
                                {editingScheduleBarberId === barber.id ? (
                                    <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Início</Label>
                                                <Input 
                                                    type="time" 
                                                    value={scheduleOpenTime} 
                                                    onChange={e => setScheduleOpenTime(e.target.value)}
                                                    className="h-8 text-sm" 
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase text-muted-foreground">Fim</Label>
                                                <Input 
                                                    type="time" 
                                                    value={scheduleCloseTime} 
                                                    onChange={e => setScheduleCloseTime(e.target.value)}
                                                    className="h-8 text-sm" 
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <Button size="sm" className="w-full h-8 bg-green-600 hover:bg-green-700 text-white" onClick={handleUpdateSchedule}>Salvar</Button>
                                            <Button size="sm" variant="ghost" className="w-full h-8" onClick={() => setEditingScheduleBarberId("")}>Cancelar</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-muted-foreground" />
                                                <span>
                                                    {barber.openTime || "08:00"} - {barber.closeTime || "18:00"}
                                                </span>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full h-8 text-xs"
                                            onClick={() => {
                                                setEditingScheduleBarberId(barber.id);
                                                setScheduleOpenTime(barber.openTime || "08:00");
                                                setScheduleCloseTime(barber.closeTime || "18:00");
                                            }}
                                        >
                                            Alterar Horário
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
             </Card>
          </TabsContent>

          {/* SITE CONTENT TAB */}
          <TabsContent value="content" className="pb-40 space-y-8">
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <CardTitle>Conexão Supabase (Salvar no Site Oficial)</CardTitle>
                <CardDescription>
                  Para salvar textos, horários e enviar fotos, o painel precisa estar autenticado no Supabase.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <Badge variant="outline" className={sbAuthed ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                    {sbAuthed ? "Supabase: Conectado" : "Supabase: Desconectado"}
                  </Badge>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={refreshSupabaseSession}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Verificar
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={handleSupabaseLogout} disabled={!sbAuthed}>
                      <LogOut className="w-4 h-4 mr-2" /> Desconectar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email do Supabase</Label>
                    <Input value={sbEmail} onChange={(e) => setSbEmail(e.target.value)} placeholder="seuemail@dominio.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha do Supabase</Label>
                    <Input type="password" value={sbPassword} onChange={(e) => setSbPassword(e.target.value)} placeholder="********" />
                  </div>
                </div>

                <Button type="button" onClick={handleSupabaseLogin} className="w-full" disabled={sbAuthed}>
                  <Lock className="w-4 h-4 mr-2" /> Conectar Supabase
                </Button>

                <p className="text-xs text-muted-foreground">
                  Dica: crie um usuário no Supabase Auth (Email/Senha) para o Gerente e use aqui.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Editar Conteúdo do Site</CardTitle>
                <CardDescription>Altere textos e informações da página inicial.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <Label>Título Principal (Hero)</Label>
                    <Input 
                        value={siteContent.hero_title} 
                        onChange={e => setSiteContent({...siteContent, hero_title: e.target.value})} 
                    />
                 </div>
                 <div className="space-y-2">
                    <Label>Subtítulo (Hero)</Label>
                    <Input 
                        value={siteContent.hero_subtitle} 
                        onChange={e => setSiteContent({...siteContent, hero_subtitle: e.target.value})} 
                    />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Título (Sobre)</Label>
                        <Input 
                            value={siteContent.about_title} 
                            onChange={e => setSiteContent({...siteContent, about_title: e.target.value})} 
                        />
                     </div>
                     <div className="space-y-2">
                        <Label>Endereço</Label>
                        <Input 
                            value={siteContent.address} 
                            onChange={e => setSiteContent({...siteContent, address: e.target.value})} 
                        />
                     </div>
                 </div>
                 <div className="space-y-2">
                    <Label>Texto (Sobre)</Label>
                    <Textarea 
                        rows={3}
                        value={siteContent.about_text} 
                        onChange={e => setSiteContent({...siteContent, about_text: e.target.value})} 
                    />
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input 
                            value={siteContent.phone} 
                            onChange={e => setSiteContent({...siteContent, phone: e.target.value})} 
                        />
                     </div>
                     <div className="space-y-2">
                        <Label>Instagram</Label>
                        <Input 
                            value={siteContent.instagram} 
                            onChange={e => setSiteContent({...siteContent, instagram: e.target.value})} 
                        />
                     </div>
                 </div>
                 <div className="space-y-2">
                    <Label>Texto do Rodapé</Label>
                    <Input 
                        value={siteContent.footer_text} 
                        onChange={e => setSiteContent({...siteContent, footer_text: e.target.value})} 
                    />
                 </div>
              </CardContent>
              <CardFooter>
                 <Button onClick={handleSaveContent} className="w-full">
                    <Save className="w-4 h-4 mr-2" /> Salvar Textos
                 </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Galeria de Fotos</CardTitle>
                <CardDescription>Adicione ou remova fotos da seção "Nosso Trabalho".</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 mb-6 bg-muted/20 p-4 rounded border">
                    <Label className="text-sm font-semibold">Adicionar Nova Foto</Label>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 space-y-2">
                            <Label className="text-xs text-muted-foreground">Opção 1: Enviar do Computador</Label>
                            <div className="flex items-center gap-2">
                                <label 
                                    htmlFor="gallery-upload" 
                                    className={`cursor-pointer flex items-center justify-center gap-2 bg-white border border-dashed border-input hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium w-full h-10 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    {isUploading ? "Enviando..." : "Escolher Arquivo"}
                                </label>
                                <input 
                                    id="gallery-upload" 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleGalleryFileChange} 
                                    disabled={isUploading}
                                />
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-center text-xs text-muted-foreground font-bold">
                            OU
                        </div>

                        <div className="flex-1 space-y-2">
                            <Label className="text-xs text-muted-foreground">Opção 2: Colar Link (URL)</Label>
                            <Input 
                                placeholder="https://..." 
                                value={newImageUrl}
                                onChange={e => setNewImageUrl(e.target.value)}
                                className="h-10"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <Label className="text-xs text-muted-foreground mb-1 block">Legenda (Opcional)</Label>
                            <Input 
                                placeholder="Ex: Corte Degradê" 
                                value={newImageCaption}
                                onChange={e => setNewImageCaption(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleAddGalleryImage} disabled={!newImageUrl || isUploading}>
                            <Plus className="w-4 h-4 mr-2" /> Salvar na Galeria
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {gallery.map(item => (
                        <div key={item.id} className="group relative aspect-square bg-muted rounded-lg overflow-hidden border">
                            <img src={item.image_url} alt={item.caption} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2">
                                <p className="text-xs text-center mb-2 line-clamp-2">{item.caption || "Sem legenda"}</p>
                                <Button variant="destructive" size="sm" onClick={() => item.id && handleDeleteGalleryImage(item.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {gallery.length === 0 && (
                        <div className="col-span-full py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                            Nenhuma imagem personalizada. O site exibirá as padrão.
                        </div>
                    )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs" className="pb-40">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Monitoramento de Erros</CardTitle>
                            <CardDescription>
                                Visualize problemas técnicos que ocorreram no sistema.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={loadLogs} className="gap-2">
                            <RefreshCw className="w-4 h-4" /> Atualizar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nível</TableHead>
                                    <TableHead>Data/Hora</TableHead>
                                    <TableHead>Mensagem</TableHead>
                                    <TableHead>Detalhes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            Nenhum log registrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log, index) => (
                                        <TableRow key={log.id || index}>
                                            <TableCell>
                                                <Badge variant="outline" className={
                                                    log.level === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    log.level === 'warn' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                }>
                                                    {log.level.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString('pt-BR')}
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">
                                                {log.message}
                                            </TableCell>
                                            <TableCell className="max-w-xs">
                                                {log.details && (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-6 text-xs">
                                                                Ver JSON
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-80 p-2 overflow-auto max-h-60">
                                                            <pre className="text-[10px] bg-muted p-2 rounded whitespace-pre-wrap">
                                                                {log.details}
                                                            </pre>
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button variant="destructive" size="sm" onClick={handleClearLogs} className="gap-2">
                        <Trash2 className="w-4 h-4" /> Limpar Histórico de Logs
                    </Button>
                </CardFooter>
            </Card>
          </TabsContent>

          {/* PROFILE TAB */}
          <TabsContent value="profile" className="max-w-xl mx-auto pb-48">
             <Card>
                <CardHeader>
                    <CardTitle>Editar Perfil</CardTitle>
                    <CardDescription>
                        Atualize suas informações de acesso e exibição no site.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col items-center gap-4 mb-6">
                        <div className="w-32 h-32 rounded-full border-4 border-muted overflow-hidden bg-muted relative group">
                             {profileAvatar ? (
                                <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
                             ) : (
                                <User className="w-full h-full p-6 text-muted-foreground" />
                             )}
                        </div>
                        
                        <div className="flex flex-col items-center gap-2">
                          <label 
                            htmlFor="avatar-upload" 
                            className="cursor-pointer flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-md transition-colors text-sm font-medium"
                          >
                            <Upload className="w-4 h-4" /> Escolher Foto do Dispositivo
                          </label>
                          <input 
                            id="avatar-upload" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileChange} 
                          />
                          <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">
                            Se não conseguir clicar, tente usar o campo de URL abaixo ou um computador.
                          </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nome de Exibição</label>
                        <Input 
                            value={profileName} 
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="Seu nome"
                        />
                        <p className="text-xs text-muted-foreground">Este é o nome que os clientes verão.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">URL da Foto (Opcional)</label>
                        <Input 
                            value={profileAvatar.startsWith("data:") ? "Imagem carregada do dispositivo" : profileAvatar} 
                            onChange={(e) => setProfileAvatar(e.target.value)}
                            placeholder="https://..."
                            disabled={profileAvatar.startsWith("data:")}
                        />
                        <p className="text-xs text-muted-foreground">
                          {profileAvatar.startsWith("data:") 
                            ? "Para usar uma URL da internet, limpe o campo acima ou carregue outra foto." 
                            : "Você pode colar um link da internet ou usar o botão acima para enviar do celular/PC."}
                        </p>
                        {profileAvatar.startsWith("data:") && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setProfileAvatar("")}
                            className="mt-1"
                          >
                            Remover foto atual
                          </Button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Lock className="w-3 h-3" /> Nova Senha
                        </label>
                        <Input 
                            type="password"
                            value={profilePassword} 
                            onChange={(e) => setProfilePassword(e.target.value)}
                            placeholder="Sua senha de acesso"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveProfile} className="w-full gap-2">
                        <Save className="w-4 h-4" /> Salvar Alterações
                    </Button>
                </CardFooter>
             </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
