// app/page.tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, Calendar, Clock, FileText, User, Truck } from "lucide-react"
import Logo from "@/public/logo-fht.svg"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Image src={Logo} alt="FHT Soluções Hospitalares" width={160} height={60} />
          <nav className="flex gap-4">
            <Link href="/login">
              <Button 
                variant="ghost"
                className="text-blue-600 hover:text-blue-700"
              >
                Entrar
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                Cadastrar
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="bg-gradient-to-r from-blue-100 to-white py-24">
          <div className="container mx-auto px-6 flex flex-col-reverse md:flex-row items-center gap-12">
            <div className="md:w-1/2">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                Conectamos médicos e hospitais com eficiência
              </h1>
              <p className="text-lg text-gray-700 mb-8">
                Encontre e gerencie oportunidades de plantão com praticidade e segurança.
              </p>
              <Link href="/register">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 text-base gap-2 rounded-xl shadow-md">
                  Comece Agora
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            <div className="md:w-1/2">
              <Image 
                src="https://res.cloudinary.com/dm8vb9gkj/image/upload/v1743168879/medical-banner-with-doctor-working-laptop_xwmwbo.jpg"
                alt="Médico em ação"
                width={600}
                height={400}
                className="rounded-2xl shadow-lg"
              />
            </div>
          </div>
        </section>

        {/* Como Funciona */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-16">
              Como funciona a plataforma FHT
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10">
              {[
                { icon: <User className="h-8 w-8 text-blue-600" />, title: "Crie seu perfil", desc: "Adicione suas especialidades e documentos de forma simples." },
                { icon: <Calendar className="h-8 w-8 text-blue-600" />, title: "Defina sua agenda", desc: "Escolha os dias e horários em que está disponível." },
                { icon: <Clock className="h-8 w-8 text-blue-600" />, title: "Receba propostas", desc: "Hospitais enviam ofertas baseadas no seu perfil." },
                { icon: <FileText className="h-8 w-8 text-blue-600" />, title: "Assine digitalmente", desc: "Contrato seguro e digital, com validade jurídica." },
              ].map(({ icon, title, desc }, idx) => (
                <div key={idx} className="flex flex-col items-center text-center p-6 bg-gray-50 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-blue-100 p-4 rounded-full mb-4">{icon}</div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- NOVA SEÇÃO DE PROJETOS ESPECIAIS --- */}
        <section className="py-20 bg-gray-50">
            <div className="container mx-auto px-6 text-center">
                 <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                    Projetos Especiais da Saúde
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-12">
                    Iniciativas de alto impacto para levar cuidado e tecnologia a quem mais precisa. Conheça e participe.
                </p>
                <div className="flex justify-center">
                    <div className="max-w-md">
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                            <div className="p-8">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-blue-100 p-3 rounded-full">
                                        <Truck className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-800 text-left">Caravana da Saúde</h3>
                                </div>
                                <p className="text-gray-600 text-left mb-6">
                                    Um projeto de telemedicina focado em levar atendimento de diversas especialidades para comunidades.
                                </p>
                                <Link href="/projetos">
                                    <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 text-base gap-2 rounded-xl shadow-md">
                                        Saiba Mais e Acesse
                                        <ArrowRight className="h-5 w-5" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-blue-700 text-white py-10 mt-auto">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm">© 2025 FHT Soluções Hospitalares. Todos os direitos reservados.</p>
          <div className="mt-4 flex justify-center gap-8 text-sm">
            <Link href="/sobre" className="hover:underline">Sobre Nós</Link>
            <Link href="/contato" className="hover:underline">Contato</Link>
            <Link href="/termos" className="hover:underline">Termos de Uso</Link>
            <Link href="/politica" className="hover:underline">Politica de Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}