"use client"

import Link from "next/link"
import Image from "next/image"
import Head from "next/head"
import { Button } from "@/components/ui/button"
import Logo from "@/public/logo-fht.svg"

export default function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white to-blue-50 dark:from-gray-900 dark:to-gray-800 text-gray-800 dark:text-white">
      <Head>
        <title>Política de Privacidade | FHT</title>
        <meta name="description" content="Saiba como a FHT coleta, armazena e protege seus dados." />
      </Head>

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Image src={Logo} alt="Logo FHT" width={160} height={60} className="cursor-pointer" />
          </Link>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 container mx-auto px-6 py-12 max-w-3xl">
        <h1 className="text-4xl font-bold mb-6">Política de Privacidade</h1>
        <p className="mb-4 text-lg">
          A sua privacidade é importante para nós. Esta política descreve como a FHT Soluções Hospitalares coleta, usa e protege suas informações.
        </p>

        <section className="space-y-6 text-base leading-relaxed">
          <div>
            <h2 className="text-xl font-semibold mb-2">1. Coleta de Informações</h2>
            <p>
              Coletamos informações fornecidas por você no momento do cadastro, como nome, e-mail, CRM e especialidade médica, bem como dados de uso da plataforma.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">2. Uso das Informações</h2>
            <p>
              Utilizamos os dados para oferecer uma experiência personalizada, facilitar a contratação de plantões e melhorar continuamente nossos serviços.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">3. Compartilhamento de Dados</h2>
            <p>
              Seus dados poderão ser compartilhados com hospitais e clínicas parceiras mediante sua autorização e somente para fins operacionais da plataforma.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">4. Segurança</h2>
            <p>
              Utilizamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou alteração.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">5. Direitos do Usuário</h2>
            <p>
              Você tem o direito de acessar, corrigir ou excluir seus dados pessoais. Para isso, entre em contato conosco pelo e-mail <strong>privacidade@fht.com.br</strong>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">6. Atualizações</h2>
            <p>
              Esta política poderá ser atualizada periodicamente. As alterações serão comunicadas através da plataforma.
            </p>
          </div>
        </section>

        {/* Botão Voltar */}
        <div className="mt-10">
          <Link href="/">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl">Voltar à Página Inicial</Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-blue-700 text-white py-6 text-center mt-auto">
        <p className="text-sm">
          © 2025 FHT Soluções Hospitalares. Todos os direitos reservados.
        </p>
        <div className="mt-2 flex justify-center gap-6 text-sm">
          <Link href="/termos" className="hover:underline">Termos de Uso</Link>
          <Link href="/politica" className="hover:underline">Política de Privacidade</Link>
        </div>
      </footer>
    </div>
  )
}
