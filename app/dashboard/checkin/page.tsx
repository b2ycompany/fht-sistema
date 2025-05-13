"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Camera, Check, MapPin } from "lucide-react"
import { getContract, recordCheckIn, recordCheckOut } from "@/lib/contract-service"
import { verifyFacialRecognition } from "@/lib/facial-recognition-service"

export default function CheckinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contractId = searchParams.get("contract")
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingContract, setIsLoadingContract] = useState(true)
  const [step, setStep] = useState<"camera" | "location" | "success">("camera")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [contract, setContract] = useState<any>(null)
  const [isCheckIn, setIsCheckIn] = useState(true)

  useEffect(() => {
    const fetchContract = async () => {
      if (!contractId) {
        setIsLoadingContract(false)
        return
      }

      try {
        const fetchedContract = await getContract(contractId)
        setContract(fetchedContract)

        // Determine if this is a check-in or check-out
        if (fetchedContract && fetchedContract.checkInTime && !fetchedContract.checkOutTime) {
          setIsCheckIn(false)
        }
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
  }, [contractId, toast])

  useEffect(() => {
    if (step === "camera") {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [step])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
      toast({
        title: "Erro ao acessar câmera",
        description: "Verifique se você concedeu permissão para acessar a câmera.",
        variant: "destructive",
      })
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        try {
          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob)
              } else {
                throw new Error("Failed to create blob from canvas")
              }
            }, "image/png")
          })

          // Verify facial recognition
          const isVerified = await verifyFacialRecognition(blob)

          if (isVerified) {
            setStep("location")
          } else {
            toast({
              title: "Verificação facial falhou",
              description: "Não foi possível verificar sua identidade. Tente novamente.",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error("Error processing image:", error)
          toast({
            title: "Erro ao processar imagem",
            description: "Ocorreu um erro ao processar sua imagem. Tente novamente.",
            variant: "destructive",
          })
        }
      }
    }
  }

  const getLocation = () => {
    setLocationError(null)

    if (!navigator.geolocation) {
      setLocationError("Geolocalização não é suportada pelo seu navegador.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })

        // In a real app, you would validate if the location is close to the hospital
        // For this demo, we'll just proceed to the next step
        handleCheckin()
      },
      (error) => {
        console.error("Error getting location:", error)
        setLocationError("Não foi possível obter sua localização. Verifique se você concedeu permissão.")
      },
    )
  }

  const handleCheckin = async () => {
    if (!contractId) return

    setIsLoading(true)

    try {
      if (isCheckIn) {
        await recordCheckIn(contractId)
        toast({
          title: "Check-in realizado com sucesso",
          description: "Seu check-in foi registrado com sucesso.",
        })
      } else {
        await recordCheckOut(contractId)
        toast({
          title: "Check-out realizado com sucesso",
          description: "Seu check-out foi registrado com sucesso.",
        })
      }

      setStep("success")
    } catch (error) {
      console.error("Error recording check-in/out:", error)
      toast({
        title: `Erro ao realizar ${isCheckIn ? "check-in" : "check-out"}`,
        description: `Ocorreu um erro ao realizar o ${isCheckIn ? "check-in" : "check-out"}.`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinish = () => {
    router.push("/dashboard/contracts")
  }

  if (isLoadingContract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Check-in/out</h1>
          <p className="text-muted-foreground">Realize o check-in/out para seu plantão</p>
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
          <h1 className="text-3xl font-bold">Check-in/out</h1>
          <p className="text-muted-foreground">Realize o check-in/out para seu plantão</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-muted-foreground mb-4">Nenhum contrato selecionado para check-in/out.</p>
            <Button onClick={() => router.push("/dashboard/contracts")}>Ver contratos</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{isCheckIn ? "Check-in" : "Check-out"}</h1>
        <p className="text-muted-foreground">
          Realize o {isCheckIn ? "check-in" : "check-out"} para seu plantão no {contract.hospital}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {step === "camera" &&
              (isCheckIn ? "Reconhecimento facial para Check-in" : "Reconhecimento facial para Check-out")}
            {step === "location" && "Verificação de localização"}
            {step === "success" && (isCheckIn ? "Check-in realizado" : "Check-out realizado")}
          </CardTitle>
          <CardDescription>
            {step === "camera" && "Posicione seu rosto na câmera para verificação"}
            {step === "location" && "Verificando sua localização"}
            {step === "success" && `Seu ${isCheckIn ? "check-in" : "check-out"} foi registrado com sucesso`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "camera" && (
            <div className="flex flex-col items-center">
              <div className="relative w-full max-w-md h-64 bg-gray-100 rounded-lg overflow-hidden mb-4">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="text-center text-sm text-muted-foreground mb-4">
                <p>Plantão: {contract.hospital}</p>
                <p>Data: {contract.date.toLocaleDateString()}</p>
                <p>Horário: {contract.time}</p>
              </div>
            </div>
          )}

          {step === "location" && (
            <div className="flex flex-col items-center">
              <div className="bg-primary/10 p-6 rounded-full mb-6">
                <MapPin className="h-12 w-12 text-primary" />
              </div>

              {locationError && <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">{locationError}</div>}

              <div className="text-center mb-4">
                <p className="font-medium">Verificando sua localização</p>
                <p className="text-sm text-muted-foreground">Precisamos verificar se você está no local do plantão</p>
              </div>

              <div className="text-center text-sm text-muted-foreground mb-4">
                <p>Local do plantão:</p>
                <p className="font-medium">{contract.location}</p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center">
              <div className="bg-green-100 p-6 rounded-full mb-6">
                <Check className="h-12 w-12 text-green-600" />
              </div>

              <div className="text-center mb-6">
                <p className="font-medium text-lg">{isCheckIn ? "Check-in" : "Check-out"} realizado com sucesso!</p>
                <p className="text-sm text-muted-foreground">
                  Seu {isCheckIn ? "check-in" : "check-out"} foi registrado às {new Date().toLocaleTimeString()}
                </p>
              </div>

              <div className="w-full max-w-md border rounded-md p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Hospital:</span>
                  <span className="font-medium">{contract.hospital}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Data:</span>
                  <span className="font-medium">{contract.date.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Horário:</span>
                  <span className="font-medium">{contract.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{isCheckIn ? "Check-in" : "Check-out"}:</span>
                  <span className="font-medium">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {step === "camera" && (
            <Button onClick={captureImage} className="gap-2">
              <Camera className="h-4 w-4" />
              Capturar imagem
            </Button>
          )}

          {step === "location" && (
            <Button onClick={getLocation} disabled={isLoading} className="gap-2">
              {isLoading ? "Verificando..." : "Verificar localização"}
            </Button>
          )}

          {step === "success" && <Button onClick={handleFinish}>Concluir</Button>}
        </CardFooter>
      </Card>
    </div>
  )
}

