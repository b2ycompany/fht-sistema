"use client"

import Link from "next/link"
import Image from "next/image"
import Head from "next/head"
import { Button } from "@/components/ui/button"
import { Mail, MapPin, Phone } from "lucide-react"
import { motion } from "framer-motion"
import Logo from "@/public/logo-fht.svg"

export default function Contato() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 dark:text-white transition-colors duration-300">
      <Head>
        <title>FHT - Contato</title>
        <meta name="description" content="Entre em contato com a FHT Soluções Hospitalares para dúvidas, parcerias ou suporte." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/">
            <Image src={Logo} alt="FHT Soluções Hospitalares" width={160} height={60} className="cursor-pointer" />
          </Link>
          <nav className="flex gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-blue-600 dark:text-blue-400 hover:text-blue-700">
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
        <section className="py-20 bg-gradient-to-r from-blue-100 to-white dark:from-blue-900 dark:to-gray-800">
          <div className="container mx-auto px-6 text-center max-w-3xl">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-bold text-gray-900 dark:text-white mb-6"
            >
              Fale com a FHT
            </motion.h1>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Estamos prontos para ajudar. Entre em contato conosco para dúvidas, parcerias ou suporte à sua clínica ou hospital.
            </p>
          </div>
        </section>

        {/* Informações de contato e formulário */}
        <section className="py-20 bg-white dark:bg-gray-800">
          <div className="container mx-auto px-6 grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Informações de Contato</h2>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex items-center gap-3">
                  <Phone className="text-blue-600" />
                  <span>(11) 99999-9999</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="text-blue-600" />
                  <span>contato@fht.com.br</span>
                </li>
                <li className="flex items-center gap-3">
                  <MapPin className="text-blue-600" />
                  <span>Av. Paulista, 1000 - São Paulo/SP</span>
                </li>
              </ul>
              <div className="mt-10">
                <iframe
                  className="w-full h-64 rounded-xl shadow-md"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.9183517617975!2d-46.64820498438526!3d-23.573958668647807!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce59c8a3c0f57f%3A0x1ba5b66cb6b8d7a9!2sAv.%20Paulista%2C%201000%20-%20Bela%20Vista%2C%20S%C3%A3o%20Paulo%20-%20SP%2C%2001310-100!5e0!3m2!1spt-BR!2sbr!4v1612981596785!5m2!1spt-BR!2sbr"
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </div>

            {/* Formulário */}
            <div>
              <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Envie uma mensagem</h2>
              <form className="space-y-6">
                <div>
                  <label htmlFor="nome" className="block mb-1 font-medium">Nome</label>
                  <input
                    type="text"
                    id="nome"
                    className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Seu nome"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block mb-1 font-medium">E-mail</label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="seuemail@email.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="mensagem" className="block mb-1 font-medium">Mensagem</label>
                  <textarea
                    id="mensagem"
                    rows={5}
                    className="w-full px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Escreva sua mensagem aqui..."
                    required
                  ></textarea>
                </div>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl">Enviar</Button>
              </form>
            </div>
          </div>

          {/* Botão Voltar */}
          <div className="text-center mt-16">
            <Link href="/">
              <Button variant="outline" className="text-blue-600 hover:text-white hover:bg-blue-600 border-blue-600">
                ← Voltar à Página Inicial
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-blue-700 text-white py-10 mt-auto">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm">
            © 2025 FHT Soluções Hospitalares. Todos os direitos reservados.
          </p>
          <div className="mt-4 flex justify-center gap-8 text-sm">
            <Link href="/sobre" className="hover:underline">Sobre Nós</Link>
            <Link href="/contato" className="hover:underline">Contato</Link>
            <Link href="/termos" className="hover:underline">Termos de Uso</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
