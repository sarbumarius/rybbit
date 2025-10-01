"use client";

import * as React from "react";
import { Check, X, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  badgeClassName?: string;
}

export function MultiSelect({
  options,
  value = [],
  onValueChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyText = "No items found.",
  disabled = false,
  className,
  badgeClassName,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Include custom values (not present in options) by mapping value[] to display labels
  const selected = React.useMemo(() => {
    const map = new Map(options.map(o => [o.value, o] as const));
    return value.map(v => map.get(v) ?? { value: v, label: v });
  }, [options, value]);

  const handleSelect = (option: MultiSelectOption) => {
    const newValue = value.includes(option.value) ? value.filter(v => v !== option.value) : [...value, option.value];
    onValueChange?.(newValue);
  };

  const handleRemove = (option: MultiSelectOption) => {
    onValueChange?.(value.filter(v => v !== option.value));
  };

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(option => option.label.toLowerCase().includes(searchLower));
  }, [options, search]);

  const canAddCustom = React.useMemo(() => {
    const trimmed = search.trim();
    if (!trimmed) return false;
    const existsInOptions = options.some(o => o.value === trimmed || o.label === trimmed);
    const alreadySelected = value.includes(trimmed);
    return !existsInOptions && !alreadySelected;
  }, [search, options, value]);

  const addCustom = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    onValueChange?.([...value, trimmed]);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between min-h-10 h-auto", selected.length > 0 && "px-3 py-2", className)}
        >
          <div className="flex gap-1 flex-wrap">
            {selected.length > 0 ? (
              selected.map(option => (
                <Badge key={option.value} variant="secondary" className={cn("mr-1", badgeClassName)}>
                  {option.label}
                  <button
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove(option);
                      }
                    }}
                    onMouseDown={e => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemove(option);
                    }}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map(option => {
                const isSelected = value.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    disabled={option.disabled}
                    onSelect={() => handleSelect(option)}
                    className="cursor-pointer"
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                );
              })}
              {canAddCustom && (
                <CommandItem
                  key="__add_custom__"
                  onSelect={addCustom}
                  className="cursor-pointer text-emerald-500"
                >
                  Add "{search.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
