"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Building, Heart, Users } from "lucide-react"
import Logo from "@/public/logo-fht.svg"

export default function Sobre() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-r from-blue-50 to-white dark:from-blue-900 dark:to-gray-800 text-gray-800 dark:text-white px-6 py-12">
      <header className="mb-12 flex justify-center">
        <Link href="/">
          <Image src={Logo} alt="FHT Soluções Hospitalares" width={160} height={60} className="cursor-pointer hover:opacity-80 transition-opacity duration-200" />
        </Link>
      </header>

      <main className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-6">Sobre Nós</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-12">
          A <strong className="text-blue-600 dark:text-blue-400">FHT Soluções Hospitalares</strong> é uma plataforma inovadora que conecta médicos e instituições de saúde de forma prática, ágil e segura. Com tecnologia de ponta e foco na experiência do usuário, facilitamos o processo de contratação de plantões, otimizando a gestão hospitalar e valorizando o trabalho médico.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full mb-4">
              <Building className="text-blue-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Missão</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Transformar a gestão hospitalar através da tecnologia, promovendo conexões eficazes entre profissionais e instituições de saúde.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full mb-4">
              <Heart className="text-blue-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Valores</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Ética, transparência, inovação, valorização do profissional da saúde e compromisso com a excelência no atendimento.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-full mb-4">
              <Users className="text-blue-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Para quem é</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              Médicos em busca de oportunidades e hospitais que desejam otimizar o processo de contratação e escala de plantões.
            </p>
          </div>
        </div>

        <Link href="/">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl">
            Voltar à Página Inicial
          </Button>
        </Link>
      </main>
    </div>
  )
}
