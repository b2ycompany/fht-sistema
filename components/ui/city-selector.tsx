// components/ui/city-selector.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
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
  setSelectedCities: (cities: string[]) => void;
}

export function CitySelector({
  selectedState,
  availableCities,
  selectedCities,
  setSelectedCities,
}: CitySelectorProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleSelectCity = (city: string) => {
    const newSelection = selectedCities.includes(city)
      ? selectedCities.filter((c) => c !== city)
      : [...selectedCities, city];
    setSelectedCities(newSelection);
  };

  const CityListContent = () => (
    <Command>
      <CommandInput placeholder="Buscar cidade..." />
      <CommandList className="max-h-[250px] overflow-y-auto">
        <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
        <CommandGroup>
          {availableCities.map((city) => (
            <CommandItem
              key={city}
              value={city}
              // AQUI ESTÁ A CORREÇÃO:
              // Voltamos a usar onSelect com a lógica correta.
              // Isso garante que a seleção funcione com mouse e teclado.
              onSelect={() => handleSelectCity(city)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  selectedCities.includes(city) ? "opacity-100" : "opacity-0"
                )}
              />
              {city}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const triggerButtonText =
    selectedCities.length > 0
      ? `${selectedCities.length} cidade(s) selecionada(s)`
      : "Selecione as cidades...";

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-9"
            disabled={!selectedState || availableCities.length === 0}
          >
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <CityListContent />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
          disabled={!selectedState || availableCities.length === 0}
        >
          {triggerButtonText}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mt-4 border-t">
          <CityListContent />
        </div>
      </DrawerContent>
    </Drawer>
  );
}