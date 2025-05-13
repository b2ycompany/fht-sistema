"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Building, Calendar, Clock, MapPin } from "lucide-react"
import { getContract, updateContractStatus, type Contract } from "@/lib/contract-service"
import Link from "next/link"

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingContract, setIsLoadingContract] = useState(true)
  const [contract, setContract] = useState<Contract | null>(null)

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const fetchedContract = await getContract(params.id)
        setContract(fetchedContract)
      } catch (error) {
        console.error("Error fetching contract:", error)
        toast({
          title: "Erro ao carregar contrato",
          description: "Não foi possível carregar os detalhes do contrato. Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingContract(false)
      }
    }

    fetchContract()
  }, [params.id, toast])

  const handleCancelContract = async () => {
    if (!contract?.id) return

    setIsLoading(true)

    try {
      await updateContractStatus(contract.id, "canceled")

      toast({
        title: "Contrato cancelado",
        description: "O contrato foi cancelado com sucesso.",
      })

      router.push("/dashboard/contracts")
    } catch (error) {
      console.error("Error canceling contract:", error)
      toast({
        title: "Erro ao cancelar contrato",
        description: "Ocorreu um erro ao cancelar o contrato.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingContract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Detalhes do Contrato</h1>
          <p className="text-muted-foreground">Visualize os detalhes do seu contrato</p>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Detalhes do Contrato</h1>
          <p className="text-muted-foreground">Visualize os detalhes do seu contrato</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-muted-foreground mb-4">Contrato não encontrado.</p>
            <Button onClick={() => router.push("/dashboard/contracts")}>Voltar para contratos</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Detalhes do Contrato</h1>
        <p className="text-muted-foreground">Visualize os detalhes do seu contrato</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{contract.hospital}</CardTitle>
              <CardDescription>{contract.specialty}</CardDescription>
            </div>
            <StatusBadge status={contract.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Informações do Plantão</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Data: {contract.date.toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Horário: {contract.time} ({contract.duration})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>Local: {contract.location}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">Valor</h3>
                <p className="text-lg font-bold">R$ {contract.value.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">
                  Valor por hora: R$ {(contract.value / Number.parseInt(contract.duration)).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Status do Contrato</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Contrato assinado em:</span>
                    <span>
                      {contract.createdAt?.toLocaleDateString()} às {contract.createdAt?.toLocaleTimeString()}
                    </span>
                  </div>

                  {contract.checkInTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Check-in realizado em:</span>
                      <span>
                        {contract.checkInTime.toLocaleDateString()} às {contract.checkInTime.toLocaleTimeString()}
                      </span>
                    </div>
                  )}

                  {contract.checkOutTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Check-out realizado em:</span>
                      <span>
                        {contract.checkOutTime.toLocaleDateString()} às {contract.checkOutTime.toLocaleTimeString()}
                      </span>
                    </div>
                  )}

                  {contract.status === "completed" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Contrato concluído em:</span>
                      <span>
                        {contract.updatedAt?.toLocaleDateString()} às {contract.updatedAt?.toLocaleTimeString()}
                      </span>
                    </div>
                  )}

                  {contract.status === "canceled" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Contrato cancelado em:</span>
                      <span>
                        {contract.updatedAt?.toLocaleDateString()} às {contract.updatedAt?.toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-medium mb-2">Contratante</h3>
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Building className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-medium">{contract.hospital}</span>
                </div>
                <p className="text-sm text-muted-foreground">{contract.location}</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          {contract.status === "upcoming" && !contract.checkInTime && (
            <>
              <Link href={`/dashboard/checkin?contract=${contract.id}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  Check-in
                </Button>
              </Link>
              <Button variant="destructive" className="flex-1" onClick={handleCancelContract} disabled={isLoading}>
                {isLoading ? "Cancelando..." : "Cancelar contrato"}
              </Button>
            </>
          )}

          {contract.status === "upcoming" && contract.checkInTime && !contract.checkOutTime && (
            <Link href={`/dashboard/checkin?contract=${contract.id}`} className="flex-1">
              <Button className="w-full">Check-out</Button>
            </Link>
          )}

          {(contract.status === "completed" || contract.status === "canceled") && (
            <Button variant="outline" className="flex-1" onClick={() => router.push("/dashboard/contracts")}>
              Voltar para contratos
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
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

