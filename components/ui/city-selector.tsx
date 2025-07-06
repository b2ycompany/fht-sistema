// components/ui/city-selector.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";

import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface CitySelectorProps {
  selectedState: string;
  availableCities: string[];
  selectedCities: string[];
  onConfirm: (cities: string[]) => void;
}

export function CitySelector({
  selectedState,
  availableCities,
  selectedCities,
  onConfirm,
}: CitySelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  
  // Estado interno para seleção temporária e busca
  const [internalSelection, setInternalSelection] = React.useState<string[]>(selectedCities);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Sincroniza o estado interno ao abrir o seletor
  React.useEffect(() => {
    if (isOpen) {
      setInternalSelection(selectedCities);
      setSearchTerm(""); // Limpa a busca ao abrir
    }
  }, [isOpen, selectedCities]);

  const handleSelectCity = (city: string) => {
    setInternalSelection(prev => 
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };
  
  const filteredCities = React.useMemo(() =>
    availableCities.filter(city =>
      city.toLowerCase().includes(searchTerm.toLowerCase())
    ), [availableCities, searchTerm]
  );

  const CityListContent = () => (
    <div className="p-2 space-y-2">
      <Input
        placeholder="Buscar cidade..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-9"
      />
      {/* Container da lista com rolagem simples e robusta */}
      <div className="max-h-[240px] overflow-y-auto pr-1">
        {filteredCities.length > 0 ? (
          filteredCities.map(city => (
            <button
              key={city}
              onClick={() => handleSelectCity(city)}
              className={cn(
                "w-full text-left p-2 text-sm rounded-md flex items-center hover:bg-accent",
                "focus:outline-none focus:ring-1 focus:ring-ring"
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4 shrink-0",
                  internalSelection.includes(city) ? "opacity-100" : "opacity-0"
                )}
              />
              <span>{city}</span>
            </button>
          ))
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma cidade encontrada.
          </div>
        )}
      </div>
    </div>
  );

  const triggerButtonText =
    selectedCities.length > 0
      ? `${selectedCities.length} cidade(s) selecionada(s)`
      : "Selecione as cidades...";
      
  const handleConfirm = () => {
    onConfirm(internalSelection);
    setIsOpen(false);
  };

  if (isDesktop) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={isOpen} className="w-full justify-between font-normal h-9">
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <CityListContent />
          {/* Rodapé com botões de ação claros */}
          <div className="p-2 border-t flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setInternalSelection([])}>Limpar</Button>
            <Button size="sm" onClick={handleConfirm}>Confirmar</Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={isOpen} className="w-full justify-between font-normal h-9">
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mt-4 border-t">
          <CityListContent />
        </div>
        {/* Rodapé com UX melhorada para mobile */}
        <DrawerFooter className="pt-2 flex-col-reverse">
          <DrawerClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DrawerClose>
          <Button onClick={handleConfirm}>
            Confirmar ({internalSelection.length})
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}