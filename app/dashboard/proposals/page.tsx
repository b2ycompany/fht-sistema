"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin } from "lucide-react"
import { getProposals, type Proposal, type ProposalStatus } from "@/lib/proposal-service"
import { useToast } from "@/hooks/use-toast"

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchProposals = async () => {
      try {
        const fetchedProposals = await getProposals()
        setProposals(fetchedProposals)
      } catch (error) {
        console.error("Error fetching proposals:", error)
        toast({
          title: "Erro ao carregar propostas",
          description: "Não foi possível carregar suas propostas. Tente novamente.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchProposals()
  }, [toast])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Propostas</h1>
          <p className="text-muted-foreground">Gerencie as propostas de trabalho que você recebeu</p>
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
        <h1 className="text-3xl font-bold">Propostas</h1>
        <p className="text-muted-foreground">Gerencie as propostas de trabalho que você recebeu</p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="accepted">Aceitas</TabsTrigger>
          <TabsTrigger value="rejected">Recusadas</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="grid gap-4">
            {proposals
              .filter((proposal) => proposal.status === "pending")
              .map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))}
            {proposals.filter((proposal) => proposal.status === "pending").length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <p className="text-muted-foreground mb-4">Você não tem propostas pendentes no momento.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="accepted">
          <div className="grid gap-4">
            {proposals
              .filter((proposal) => proposal.status === "accepted")
              .map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))}
            {proposals.filter((proposal) => proposal.status === "accepted").length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <p className="text-muted-foreground mb-4">Você não tem propostas aceitas no momento.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rejected">
          <div className="grid gap-4">
            {proposals
              .filter((proposal) => proposal.status === "rejected")
              .map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))}
            {proposals.filter((proposal) => proposal.status === "rejected").length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <p className="text-muted-foreground mb-4">Você não tem propostas recusadas no momento.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{proposal.hospital}</CardTitle>
            <CardDescription>{proposal.specialty}</CardDescription>
          </div>
          <StatusBadge status={proposal.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{proposal.date.toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {proposal.time} ({proposal.duration})
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{proposal.location}</span>
          </div>

          {proposal.status === "pending" && (
            <div className="flex gap-2 mt-4">
              <Link href={`/dashboard/proposals/${proposal.id}`} className="flex-1">
                <Button className="w-full">Ver detalhes</Button>
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: ProposalStatus }) {
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

