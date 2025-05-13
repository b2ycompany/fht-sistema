"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Building, Calendar, Clock, MapPin, User } from "lucide-react"
import { getProposal, updateProposalStatus, type Proposal } from "@/lib/proposal-service"
import { createContract } from "@/lib/contract-service"

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingProposal, setIsLoadingProposal] = useState(true)
  const [showContractDialog, setShowContractDialog] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)

  useEffect(() => {
    const fetchProposal = async () => {
      try {
        const fetchedProposal = await getProposal(params.id)
        setProposal(fetchedProposal)
      } catch (error) {
        console.error("Error fetching proposal:", error)
        toast({
          title: "Erro ao carregar proposta",
          description: "Não foi possível carregar os detalhes da proposta. Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setIsLoadingProposal(false)
      }
    }

    fetchProposal()
  }, [params.id, toast])

  const handleAccept = () => {
    setShowContractDialog(true)
  }

  const handleReject = async () => {
    setIsLoading(true)

    try {
      await updateProposalStatus(params.id, "rejected")

      toast({
        title: "Proposta recusada",
        description: "A proposta foi recusada com sucesso.",
      })

      router.push("/dashboard/proposals")
    } catch (error) {
      console.error("Error rejecting proposal:", error)
      toast({
        title: "Erro ao recusar proposta",
        description: "Ocorreu um erro ao recusar a proposta.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignContract = async () => {
    setIsLoading(true)

    try {
      // Create contract from proposal
      await createContract(params.id)

      toast({
        title: "Contrato assinado",
        description: "O contrato foi assinado com sucesso.",
      })

      setShowContractDialog(false)
      router.push("/dashboard/contracts")
    } catch (error) {
      console.error("Error signing contract:", error)
      toast({
        title: "Erro ao assinar contrato",
        description: "Ocorreu um erro ao assinar o contrato.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingProposal) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Detalhes da Proposta</h1>
          <p className="text-muted-foreground">Visualize os detalhes da proposta e decida se deseja aceitá-la</p>
        </div>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Detalhes da Proposta</h1>
          <p className="text-muted-foreground">Visualize os detalhes da proposta e decida se deseja aceitá-la</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-muted-foreground mb-4">Proposta não encontrada.</p>
            <Button onClick={() => router.push("/dashboard/proposals")}>Voltar para propostas</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Detalhes da Proposta</h1>
        <p className="text-muted-foreground">Visualize os detalhes da proposta e decida se deseja aceitá-la</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{proposal.hospital}</CardTitle>
                <CardDescription>{proposal.specialty}</CardDescription>
              </div>
              <StatusBadge status={proposal.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{proposal.date.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {proposal.time} ({proposal.duration})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{proposal.location}</span>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-2">Descrição do plantão</h3>
              <p className="text-sm text-muted-foreground">{proposal.description}</p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Requisitos</h3>
              <p className="text-sm text-muted-foreground">{proposal.requirements}</p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Valor</h3>
              <p className="text-sm">
                <span className="font-bold text-lg">R$ {proposal.value.toFixed(2)}</span>
                <span className="text-muted-foreground">
                  {" "}
                  (R$ {(proposal.value / Number.parseInt(proposal.duration)).toFixed(2)}/hora)
                </span>
              </p>
            </div>
          </CardContent>
          {proposal.status === "pending" && (
            <CardFooter className="flex gap-2">
              <Button className="flex-1" onClick={handleAccept} disabled={isLoading}>
                Aceitar proposta
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleReject} disabled={isLoading}>
                Recusar proposta
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perfil do Contratante</CardTitle>
            <CardDescription>Informações sobre o hospital contratante</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Building className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{proposal.hospitalProfile.name}</h3>
                <p className="text-sm text-muted-foreground">Desde {proposal.hospitalProfile.founded}</p>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Sobre</h3>
              <p className="text-sm text-muted-foreground">{proposal.hospitalProfile.description}</p>
            </div>

            <div>
              <h3 className="font-medium mb-2">Equipe</h3>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{proposal.hospitalProfile.employees} funcionários</span>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Especialidades</h3>
              <div className="flex flex-wrap gap-2">
                {proposal.hospitalProfile.specialties.map((specialty) => (
                  <Badge key={specialty} variant="outline">
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Contrato Digital</DialogTitle>
            <DialogDescription>Leia atentamente os termos e condições antes de assinar o contrato</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto border rounded-md p-4 text-sm">
            <h3 className="font-bold text-lg mb-4">CONTRATO DE PRESTAÇÃO DE SERVIÇOS MÉDICOS</h3>

            <p className="mb-4">
              <strong>CONTRATANTE:</strong> {proposal.hospital}, inscrito no CNPJ sob o nº 00.000.000/0001-00, com sede
              na
              {proposal.location}, neste ato representado por seu diretor, Sr. José Silva.
            </p>

            <p className="mb-4">
              <strong>CONTRATADO:</strong> Dr. João Silva, médico, inscrito no CRM/SP sob o nº 12345, CPF nº
              123.456.789-00, residente e domiciliado na Rua Exemplo, 123, São Paulo, SP.
            </p>

            <h4 className="font-bold mt-6 mb-2">CLÁUSULA PRIMEIRA - OBJETO</h4>
            <p className="mb-4">
              O presente contrato tem por objeto a prestação de serviços médicos pelo CONTRATADO ao CONTRATANTE, na
              especialidade de {proposal.specialty}, na modalidade de plantão médico, a ser realizado no dia{" "}
              {proposal.date.toLocaleDateString()}, das
              {proposal.time}, com duração total de {proposal.duration}.
            </p>

            <h4 className="font-bold mt-6 mb-2">CLÁUSULA SEGUNDA - VALOR E FORMA DE PAGAMENTO</h4>
            <p className="mb-4">
              Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO o valor total de R${" "}
              {proposal.value.toFixed(2)} ({valorPorExtenso(proposal.value)}), correspondente a R${" "}
              {(proposal.value / Number.parseInt(proposal.duration)).toFixed(2)} por hora trabalhada.
            </p>
            <p className="mb-4">
              O pagamento será realizado em até 5 (cinco) dias úteis após a conclusão do plantão, mediante depósito
              bancário na conta indicada pelo CONTRATADO.
            </p>

            <h4 className="font-bold mt-6 mb-2">CLÁUSULA TERCEIRA - OBRIGAÇÕES DO CONTRATADO</h4>
            <p className="mb-4">São obrigações do CONTRATADO:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Comparecer ao local de trabalho no dia e horário estabelecidos;</li>
              <li>Realizar o check-in e check-out através do aplicativo, utilizando a leitura facial;</li>
              <li>Prestar os serviços médicos com zelo, diligência e ética profissional;</li>
              <li>Cumprir as normas e regulamentos internos do CONTRATANTE;</li>
              <li>Preencher corretamente os prontuários e documentos médicos;</li>
              <li>Utilizar os equipamentos de proteção individual fornecidos pelo CONTRATANTE;</li>
            </ul>

            <h4 className="font-bold mt-6 mb-2">CLÁUSULA QUARTA - OBRIGAÇÕES DO CONTRATANTE</h4>
            <p className="mb-4">São obrigações do CONTRATANTE:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Fornecer as condições necessárias para a prestação dos serviços;</li>
              <li>Fornecer os equipamentos de proteção individual;</li>
              <li>Efetuar o pagamento na forma e prazo estabelecidos;</li>
              <li>Fornecer alimentação durante o período de plantão;</li>
            </ul>

            <h4 className="font-bold mt-6 mb-2">CLÁUSULA QUINTA - RESCISÃO</h4>
            <p className="mb-4">
              O presente contrato poderá ser rescindido por qualquer das partes, mediante comunicação prévia de 24
              (vinte e quatro) horas, sem prejuízo do pagamento proporcional pelos serviços já prestados.
            </p>

            <h4 className="font-bold mt-6 mb-2">CLÁUSULA SEXTA - DISPOSIÇÕES GERAIS</h4>
            <p className="mb-4">
              O presente contrato não estabelece vínculo empregatício entre as partes, sendo o CONTRATADO responsável
              pelo recolhimento dos tributos incidentes sobre os valores recebidos.
            </p>

            <h4 className="font-bold mt-6 mb-2">CLÁUSULA SÉTIMA - FORO</h4>
            <p className="mb-4">
              Fica eleito o foro da Comarca de São Paulo para dirimir quaisquer dúvidas ou controvérsias oriundas do
              presente contrato.
            </p>

            <p className="mt-8 mb-4">
              E, por estarem assim justas e contratadas, as partes assinam o presente contrato eletronicamente, para que
              produza seus efeitos legais.
            </p>

            <p className="mb-4">São Paulo, {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContractDialog(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleSignContract} disabled={isLoading}>
              {isLoading ? "Processando..." : "Assinar contrato digitalmente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
        Pendente
      </Badge>
    )
  }

  if (status === "accepted") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        Aceita
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
      Recusada
    </Badge>
  )
}

// Função auxiliar para converter valor numérico em texto por extenso (simplificada)
function valorPorExtenso(valor: number): string {
  const valorInteiro = Math.floor(valor)
  const centavos = Math.round((valor - valorInteiro) * 100)

  if (valorInteiro === 1200) {
    return "mil e duzentos reais"
  } else if (valorInteiro === 800) {
    return "oitocentos reais"
  } else if (valorInteiro === 1500) {
    return "mil e quinhentos reais"
  } else {
    return `${valorInteiro} reais${centavos > 0 ? ` e ${centavos} centavos` : ""}`
  }
}

