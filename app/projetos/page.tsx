// app/projetos/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Truck } from 'lucide-react';

export default function ProjectsPage() {
  const projects = [
    {
      id: 'caravana-da-saude-sp',
      title: 'Multirão da Saúde',
      description: 'Um projeto de telemedicina focado em levar atendimento de diversas especialidades para comunidades.',
      status: 'Ativo',
      href: '/projetos/caravana/login' // Link para o login específico da caravana
    }
  ];

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Projetos da Saúde
        </h1>
        <p className="mt-4 text-lg leading-7 text-gray-600">
          Iniciativas especiais para levar saúde e bem-estar para mais perto das pessoas.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="space-y-8">
          {projects.map((project) => (
            <Card key={project.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-3 text-2xl text-gray-800">
                    <Truck className="h-8 w-8 text-blue-600" />
                    {project.title}
                  </CardTitle>
                  <span className="text-xs font-semibold py-1 px-3 rounded-full bg-green-100 text-green-800">
                    {project.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {project.description}
                </CardDescription>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full sm:w-auto">
                  <Link href={project.href}>
                    Acessar Portal do Profissional <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}