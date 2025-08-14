"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Stethoscope, Loader2, AlertTriangle } from "lucide-react";
import Logo from "@/public/logo-fht.svg";
import { getTelemedicineSpecialties } from '@/lib/telemedicine-service';
import { Card, CardContent } from '@/components/ui/card';

export default function TelemedicinePortalPage() {
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpecialties = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getTelemedicineSpecialties();
        setSpecialties(data);
      } catch (err: any) {
        setError(err.message || "Não foi possível conectar ao servidor.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchSpecialties();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/">
            <Image src={Logo} alt="FHT Soluções Hospitalares" width={160} height={60} />
          </Link>
          <nav className="flex gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-blue-600 hover:text-blue-700">Entrar</Button>
            </Link>
            <Link href="/dashboard">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6">Área do Médico</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-r from-blue-100 via-white to-blue-50 py-20">
          <div className="container mx-auto px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
              Portal de Telemedicina FHT
            </h1>
            <p className="text-lg text-gray-700 max-w-3xl mx-auto">
              Cuidado e tecnologia ao seu alcance. Selecione a especialidade desejada para ver os próximos passos.
            </p>
          </div>
        </section>

        <section id="especialidades" className="py-20 bg-white">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Nossas Especialidades Disponíveis</h2>
            
            {isLoading && (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              </div>
            )}

            {error && (
              <div className="text-center py-8 text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
                <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                <p className="font-semibold">Erro ao carregar especialidades.</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {!isLoading && !error && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {specialties.length > 0 ? (
                    specialties.map((specialty) => (
                      <Card key={specialty} className="group hover:border-blue-600 hover:shadow-lg transition-all duration-300 cursor-pointer h-full">
                        <CardContent className="p-6 flex flex-col items-center text-center">
                          <div className="bg-blue-100 p-4 rounded-full mb-4 transition-colors duration-300 group-hover:bg-blue-600">
                            <Stethoscope className="h-8 w-8 text-blue-600 transition-colors duration-300 group-hover:text-white" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-800 capitalize">
                            {specialty.toLowerCase()}
                          </h3>
                        </CardContent>
                      </Card>
                    ))
                ) : (
                    <p className="col-span-full text-center text-muted-foreground">Nenhuma especialidade de telemedicina disponível no momento.</p>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-blue-700 text-white py-10 mt-auto">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm">© 2025 FHT Soluções Hospitalares. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}