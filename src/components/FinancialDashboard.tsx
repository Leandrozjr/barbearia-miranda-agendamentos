import { useMemo, useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from "recharts";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { toast } from "sonner";

import type { Appointment, Expense } from "@/types";
import { BARBERS } from "@/lib/data";
import { getExpenses, addExpense, deleteExpense, getServices } from "@/lib/storage";
import type { Service } from "@/types";

import type { AdminUser } from "@/lib/storage";

interface FinancialDashboardProps {
  appointments: Appointment[];
  currentUser: AdminUser;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function FinancialDashboard({ appointments, currentUser }: FinancialDashboardProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [newExpenseDesc, setNewExpenseDesc] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState<'marketing' | 'material' | 'fixed' | 'other'>('marketing');
  
  // Month Filter State
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  // Load Expenses and Services
  useEffect(() => {
    loadExpenses();
    getServices().then(setServices);
  }, []);

  const loadExpenses = async () => {
    const data = await getExpenses();
    setExpenses(data);
  };

  const handleAddExpense = async () => {
    if (!newExpenseDesc || !newExpenseAmount) {
      toast.error("Preencha a descrição e o valor.");
      return;
    }

    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido.");
      return;
    }

    try {
      await addExpense({
        description: newExpenseDesc,
        amount,
        category: newExpenseCategory,
        date: new Date().toISOString().split('T')[0],
        barberId: currentUser.isMaster ? undefined : currentUser.id // Link expense to barber if not master
      });

      setNewExpenseDesc("");
      setNewExpenseAmount("");
      loadExpenses();
      toast.success("Despesa registrada!");
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('relation "expenses" does not exist')) {
        toast.error("Erro: Tabela de despesas não encontrada. Por favor, atualize o banco de dados (ver instruções).");
      } else {
        toast.error("Erro ao salvar despesa: " + (error?.message || "Erro desconhecido"));
      }
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm("Tem certeza que deseja remover esta despesa?")) {
      await deleteExpense(id);
      loadExpenses();
      toast.success("Despesa removida.");
    }
  };

  // Cálculos Financeiros
  const data = useMemo(() => {
    // FILTER DATA BASED ON USER ROLE
    const isMaster = currentUser.isMaster;
    
    const filteredAppointments = isMaster 
      ? appointments 
      : appointments.filter(a => a.barberId === currentUser.id);

    const filteredExpenses = isMaster
      ? expenses
      : expenses.filter(e => e.barberId === currentUser.id);

    // FILTER BY MONTH
    const validApps = filteredAppointments.filter(a => {
      if (a.status === 'cancelled') return false;
      return a.date.startsWith(selectedMonth);
    });

    const monthlyExpenses = filteredExpenses.filter(e => e.date.startsWith(selectedMonth));

    // 1. Receita (Revenue)
    const totalRevenue = validApps.reduce((acc, app) => {
      const service = services.find(s => s.id === app.serviceId);
      return acc + (service?.price || 0);
    }, 0);

    // 2. Despesas (Expenses)
    const totalExpenses = monthlyExpenses.reduce((acc, exp) => acc + Number(exp.amount), 0);

    // 3. Lucro Líquido (Net Profit)
    const netProfit = totalRevenue - totalExpenses;

    // 4. Receita por Serviço
    const revenueByServiceMap = validApps.reduce((acc, app) => {
      const service = services.find(s => s.id === app.serviceId);
      if (!service) return acc;
      acc[service.name] = (acc[service.name] || 0) + service.price;
      return acc;
    }, {} as Record<string, number>);

    const revenueByService = Object.entries(revenueByServiceMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 5. Receita por Profissional (Only relevant for Master)
    const revenueByBarberMap = validApps.reduce((acc, app) => {
      const barber = BARBERS.find(b => b.id === app.barberId);
      const service = services.find(s => s.id === app.serviceId);
      const name = barber?.name || "Desconhecido";
      const price = service?.price || 0;
      acc[name] = (acc[name] || 0) + price;
      return acc;
    }, {} as Record<string, number>);

    const revenueByBarber = Object.entries(revenueByBarberMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 6. Despesas por Categoria
    const expensesByCategoryMap = monthlyExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
      return acc;
    }, {} as Record<string, number>);

    const expensesByCategory = Object.entries(expensesByCategoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // 7. Receita por Dia (Tendência Mensal)
    const revenueByDateMap = validApps.reduce((acc, app) => {
      const date = app.date; // YYYY-MM-DD
      const service = services.find(s => s.id === app.serviceId);
      const price = service?.price || 0;
      acc[date] = (acc[date] || 0) + price;
      return acc;
    }, {} as Record<string, number>);

    // Generate all days for the selected month
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate)
    });

    const revenueTrend = daysInMonth.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return {
        date: format(d, 'dd'), // Show only day number
        value: revenueByDateMap[dateStr] || 0
      };
    });

    // 8. Atendimentos por Profissional (Produtividade)
    const appointmentsByBarberMap = validApps.reduce((acc, app) => {
      const barber = BARBERS.find(b => b.id === app.barberId);
      const name = barber?.name || "Desconhecido";
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const appointmentsByBarber = Object.entries(appointmentsByBarberMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      revenueByService,
      revenueByBarber,
      expensesByCategory,
      revenueTrend,
      appointmentsByBarber,
      totalCount: validApps.length,
      filteredExpenses: monthlyExpenses // Expose for list
    };
  }, [appointments, expenses, currentUser, selectedMonth, services]);

  const formatBRL = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      'marketing': 'Marketing / Ads',
      'material': 'Materiais',
      'fixed': 'Custos Fixos',
      'other': 'Outros'
    };
    return map[cat] || cat;
  };

  // Generate last 12 months for selector
  const availableMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), i);
      return {
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy", { locale: ptBR })
      };
    });
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Month Selector */}
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Visão Geral Financeira</h2>
            <p className="text-sm text-muted-foreground capitalize">
              {format(parseISO(selectedMonth + "-01"), "MMMM yyyy", { locale: ptBR })}
            </p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(m => (
              <SelectItem key={m.value} value={m.value} className="capitalize">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Receita */}
        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" /> Faturamento Bruto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">{formatBRL(data.totalRevenue)}</div>
          </CardContent>
        </Card>
        
        {/* Despesas */}
        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" /> Total Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{formatBRL(data.totalExpenses)}</div>
          </CardContent>
        </Card>

        {/* Lucro */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-500" /> Lucro Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-800">{formatBRL(data.netProfit)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Margem: {data.totalRevenue > 0 ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expense Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>Controle de Despesas</CardTitle>
          <CardDescription>Registre gastos com Tráfego Pago, Materiais e outros custos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6 items-end border-b pb-6">
            <div className="flex-1 space-y-2 w-full">
              <label className="text-sm font-medium">Descrição</label>
              <Input 
                placeholder="Ex: Campanha Google Ads Janeiro" 
                value={newExpenseDesc}
                onChange={(e) => setNewExpenseDesc(e.target.value)}
              />
            </div>
            <div className="w-full md:w-40 space-y-2">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input 
                type="number" 
                placeholder="0.00" 
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
              />
            </div>
            <div className="w-full md:w-48 space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={newExpenseCategory} onValueChange={(v: any) => setNewExpenseCategory(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing / Ads</SelectItem>
                  <SelectItem value="material">Materiais</SelectItem>
                  <SelectItem value="fixed">Custos Fixos</SelectItem>
                  <SelectItem value="other">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddExpense} className="w-full md:w-auto gap-2 bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4" /> Adicionar Despesa
            </Button>
          </div>

          <div className="rounded-md border max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                      Nenhuma despesa registrada neste mês.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.filteredExpenses
                    .slice().reverse().map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(expense.date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                          {getCategoryLabel(expense.category)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        - {formatBRL(Number(expense.amount))}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteExpense(expense.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência de Faturamento</CardTitle>
          <CardDescription>Evolução da receita nos últimos 7 dias.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.revenueTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
              <Tooltip 
                contentStyle={{ backgroundColor: "#111", border: "none", borderRadius: "8px", color: "#FFF" }}
                itemStyle={{ color: "#FFD700" }}
                formatter={(value: number) => [formatBRL(value), "Faturamento"]}
              />
              <Area type="monotone" dataKey="value" stroke="#FFD700" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Productivity Chart (Master Only) */}
      {currentUser.isMaster && (
        <Card>
          <CardHeader>
            <CardTitle>Produtividade (Atendimentos)</CardTitle>
            <CardDescription>Quantidade de clientes atendidos por profissional.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.appointmentsByBarber} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fill: '#666'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}}
                  contentStyle={{ backgroundColor: "#111", border: "none", borderRadius: "8px", color: "#FFF" }}
                  formatter={(value: number) => [value, "Atendimentos"]}
                />
                <Bar dataKey="value" name="Atendimentos" radius={[0, 6, 6, 0]} barSize={32}>
                    {data.appointmentsByBarber.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#333', '#666', '#999', '#CCC'][index % 4]} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {currentUser.isMaster && (
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Faturamento por Profissional</CardTitle>
              <CardDescription>Receita bruta gerada (sem descontar despesas).</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByBarber} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={(val) => `R$${val}`} hide />
                  <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12, fill: '#666'}} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: '#f9fafb'}}
                    contentStyle={{ backgroundColor: "#111", border: "none", borderRadius: "8px", color: "#FFF" }}
                    formatter={(value: number) => [formatBRL(value), "Faturamento"]}
                  />
                  <Bar dataKey="value" name="Faturamento" radius={[0, 6, 6, 0]} barSize={32}>
                      {data.revenueByBarber.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className={currentUser.isMaster ? "col-span-1" : "col-span-2"}>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
            <CardDescription>Onde o dinheiro está sendo gasto.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {data.expensesByCategory.length > 0 ? (
                <PieChart>
                  <Pie
                    data={data.expensesByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {data.expensesByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#111", border: "none", borderRadius: "8px", color: "#FFF" }}
                    formatter={(value: number, name: string) => [formatBRL(value), getCategoryLabel(name)]}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    formatter={(value) => <span className="text-xs text-muted-foreground ml-1">{getCategoryLabel(value)}</span>}
                  />
                </PieChart>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhuma despesa registrada.
                </div>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
