"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, FileText, MessageSquare } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getTimeSlots } from "@/lib/availability-service"
import { getProposals } from "@/lib/proposal-service"
import { getContracts } from "@/lib/contract-service"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState({
    availableDays: 0,
    newProposals: 0,
    activeContracts: 0,
    hoursWorked: 0,
    upcomingShifts: [],
    recentProposals: [],
    monthlyHours: [] // Dados para o gráfico
  })
  const { toast } = useToast()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [timeSlots, proposals, contracts] = await Promise.all([getTimeSlots(), getProposals(), getContracts()])

        // Métricas do dashboard
        const availableDays = timeSlots.length
        const newProposals = proposals.filter((p) => p.status === "pending").length
        const activeContracts = contracts.filter((c) => c.status === "upcoming").length

        // Horas trabalhadas
        let hoursWorked = 0
        const monthlyHoursMap = new Map<string, number>()
        contracts
          .filter((c) => c.status === "completed")
          .forEach((contract) => {
            const hours = Number.parseInt(contract.duration) || 0
            if (!isNaN(hours)) {
              hoursWorked += hours
              const month = contract.date.toLocaleString("default", { month: "short", year: "numeric" })
              monthlyHoursMap.set(month, (monthlyHoursMap.get(month) || 0) + hours)
            }
          })

        // Dados para o gráfico (últimos 6 meses como exemplo)
        const monthlyHours = Array.from(monthlyHoursMap, ([name, value]) => ({ name, hours: value }))

        // Próximos plantões
        const upcomingShifts = contracts
          .filter((c) => c.status === "upcoming")
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .slice(0, 2)

        // Propostas recentes
        const recentProposals = proposals
          .filter((p) => p.status === "pending")
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 3)

        setDashboardData({
          availableDays,
          newProposals,
          activeContracts,
          hoursWorked,
          upcomingShifts,
          recentProposals,
          monthlyHours,
        })
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os dados do dashboard. Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [toast])

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard FHT</h1>

      {/* Cards de Métricas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Disponibilidade</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{dashboardData.availableDays}</div>
            <p className="text-xs text-gray-600">Dias disponíveis este mês</p>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Propostas</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{dashboardData.newProposals}</div>
            <p className="text-xs text-gray-600">Novas propostas</p>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Contratos</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{dashboardData.activeContracts}</div>
            <p className="text-xs text-gray-600">Contratos ativos</p>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Horas</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{dashboardData.hoursWorked}h</div>
            <p className="text-xs text-gray-600">Horas trabalhadas este mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico e Listas */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Horas Trabalhadas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">Horas Trabalhadas por Mês</CardTitle>
            <CardDescription>Evolução das suas horas ao longo do tempo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.monthlyHours}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#fff", borderColor: "#e5e7eb" }} 
                    labelStyle={{ color: "#1f2937" }}
                  />
                  <Bar dataKey="hours" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Próximos Plantões */}
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">Próximos Plantões</CardTitle>
            <CardDescription>Seus plantões agendados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData.upcomingShifts.length > 0 ? (
                dashboardData.upcomingShifts.map((shift, index) => (
                  <div
                    key={shift.id}
                    className={`flex items-center justify-between ${index < dashboardData.upcomingShifts.length - 1 ? "border-b pb-4" : ""}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{shift.hospital}</p>
                      <p className="text-sm text-gray-600">{shift.specialty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{shift.date.toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600">{shift.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-600 py-4">Nenhum plantão agendado</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Propostas Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-gray-900">Propostas Recentes</CardTitle>
            <CardDescription>Últimas propostas recebidas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData.recentProposals.length > 0 ? (
                dashboardData.recentProposals.map((proposal, index) => (
                  <div
                    key={proposal.id}
                    className={`flex items-center justify-between ${index < dashboardData.recentProposals.length - 1 ? "border-b pb-4" : ""}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{proposal.hospital}</p>
                      <p className="text-sm text-gray-600">{proposal.specialty}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{proposal.date.toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600">{proposal.duration} (plantão)</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-600 py-4">Nenhuma proposta recente</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}