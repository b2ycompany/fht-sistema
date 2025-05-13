"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import Logo from "@/public/logo-fht.svg"

export default function Termos() {
  const [aceito, setAceito] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-r from-blue-50 to-white dark:from-gray-800 dark:to-gray-900 text-gray-800 dark:text-white transition-colors duration-300">
      <header className="w-full p-6 flex items-center justify-center">
        <Link href="/">
          <Image src={Logo} alt="FHT Soluções Hospitalares" width={160} height={60} className="cursor-pointer" />
        </Link>
      </header>

      <main className="flex flex-col items-center justify-center flex-1 px-6">
        <div className="max-w-3xl text-center">
          <h1 className="text-4xl font-bold mb-4">Termos de Uso</h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Ao utilizar a plataforma FHT, você concorda com os nossos termos e condições. Leia atentamente as regras abaixo:
          </p>

          <div className="text-left bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md space-y-4">
            <p><strong>1. Uso da Plataforma:</strong> O acesso e uso são destinados a médicos e hospitais devidamente cadastrados.</p>
            <p><strong>2. Privacidade:</strong> Seus dados são protegidos conforme nossa <Link href="/politica" className="text-blue-600 dark:text-blue-400 underline">Política de Privacidade</Link>.</p>
            <p><strong>3. Responsabilidades:</strong> Cada usuário é responsável pelas informações fornecidas e pelo cumprimento dos compromissos acordados.</p>
            <p><strong>4. Alterações:</strong> A FHT pode alterar estes termos, sendo responsabilidade do usuário revisá-los periodicamente.</p>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <input
              type="checkbox"
              id="aceite"
              checked={aceito}
              onChange={() => setAceito(!aceito)}
              className="w-5 h-5 rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="aceite" className="text-gray-700 dark:text-gray-300 text-sm">
              Declaro que li e aceito os <strong>Termos de Uso</strong> e a <Link href="/politica" className="underline">Política de Privacidade</Link>.
            </label>
          </div>

          <Link href="/" className="mt-6 inline-block">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl">
              Voltar à Página Inicial
            </Button>
          </Link>
        </div>
      </main>

      <footer className="bg-blue-700 text-white text-center py-6">
        <p className="text-sm">© 2025 FHT Soluções Hospitalares. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
