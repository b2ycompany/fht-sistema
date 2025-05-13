"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin } from "lucide-react"
import { getContracts, type Contract, type ContractStatus } from "@/lib/contract-service"
import { useToast } from "@/hooks/use-toast"

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const fetchedContracts = await getContracts()
        setContracts(fetchedContracts)
      } catch (error) {
        console.error("Error fetching contracts:", error)
        toast({
          title: "Erro ao carregar contratos",
          description: "Não foi possível carregar seus contratos. Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchContracts()
  }, [toast])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">Gerencie seus contratos de plantão médico</p>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Contratos</h1>
        <p className="text-muted-foreground">Gerencie seus contratos de plantão médico</p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Próximos</TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
          <TabsTrigger value="canceled">Cancelados</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <div className="grid gap-4">
            {contracts
              .filter((contract) => contract.status === "upcoming")
              .map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))}
            {contracts.filter((contract) => contract.status === "upcoming").length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <p className="text-muted-foreground mb-4">Você não tem contratos próximos no momento.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed">
          <div className="grid gap-4">
            {contracts
              .filter((contract) => contract.status === "completed")
              .map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))}
            {contracts.filter((contract) => contract.status === "completed").length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <p className="text-muted-foreground mb-4">Você não tem contratos concluídos no momento.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="canceled">
          <div className="grid gap-4">
            {contracts
              .filter((contract) => contract.status === "canceled")
              .map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))}
            {contracts.filter((contract) => contract.status === "canceled").length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <p className="text-muted-foreground mb-4">Você não tem contratos cancelados no momento.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ContractCard({ contract }: { contract: Contract }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{contract.hospital}</CardTitle>
            <CardDescription>{contract.specialty}</CardDescription>
          </div>
          <StatusBadge status={contract.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{contract.date.toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {contract.time} ({contract.duration})
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{contract.location}</span>
          </div>
          <div className="mt-2 pt-2 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Valor total:</span>
              <span className="font-bold">R$ {contract.value.toFixed(2)}</span>
            </div>
          </div>

          {contract.status === "upcoming" && (
            <div className="flex gap-2 mt-4">
              <Link href={`/dashboard/checkin?contract=${contract.id}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  Check-in
                </Button>
              </Link>
              <Link href={`/dashboard/contracts/${contract.id}`} className="flex-1">
                <Button className="w-full">Ver detalhes</Button>
              </Link>
            </div>
          )}

          {contract.status === "completed" && (
            <div className="flex gap-2 mt-4">
              <Link href={`/dashboard/contracts/${contract.id}`} className="flex-1">
                <Button className="w-full">Ver detalhes</Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: ContractStatus }) {
  if (status === "upcoming") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        Próximo
      </Badge>
    )
  }

  if (status === "completed") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        Concluído
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
      Cancelado
    </Badge>
  )
}

