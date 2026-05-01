import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

/**
 * Single-select combobox with search (cmdk), for long option lists inside dialogs.
 * @param {{ value: string; label: string; searchValue?: string }[]} options
 * @param {(ctx: { close: () => void }) => React.ReactNode} [footer] — e.g. “Add new…” actions
 */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  className,
  contentClassName,
  footer,
  'aria-invalid': ariaInvalid,
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            'h-10 min-h-10 w-full justify-between border-input bg-transparent px-3 py-2 text-left text-sm font-normal shadow-sm ring-offset-background hover:bg-accent/50 sm:text-base',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 sm:h-5 sm:w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          'z-[10050] flex max-h-[min(520px,78vh)] w-[max(var(--radix-popover-trigger-width),min(22rem,calc(100vw-2rem)))] max-w-[min(40rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0',
          contentClassName
        )}
        onWheel={(e) => e.stopPropagation()}
      >
        <Command
          shouldFilter
          className="[&_[cmdk-input-wrapper]]:px-3 [&_[cmdk-input-wrapper]]:py-1 [&_[cmdk-input]]:h-11 [&_[cmdk-input]]:py-2 [&_[cmdk-input]]:text-base [&_[cmdk-item]]:min-h-11 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]]:text-base [&_[cmdk-item]_svg]:!h-5 [&_[cmdk-item]_svg]:!w-5"
        >
          <CommandInput placeholder={searchPlaceholder} className="text-base" />
          <CommandList className="max-h-[min(380px,55vh)] text-base">
            <CommandEmpty className="py-8 text-base">{emptyMessage}</CommandEmpty>
            <CommandGroup className="p-1.5">
              {options.map((o) => (
                <CommandItem
                  key={String(o.value)}
                  value={(`${o.label} ${o.searchValue ?? ''} ${String(o.value)}`).trim()}
                  className="cursor-pointer rounded-md px-3"
                  onSelect={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2.5 h-5 w-5 shrink-0',
                      String(value) === String(o.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="min-w-0 flex-1 leading-snug">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {footer ? (
            <div className="border-t p-2">
              {typeof footer === 'function' ? footer({ close: () => setOpen(false) }) : footer}
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
