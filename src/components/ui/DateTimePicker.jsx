"use client"

import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

export function DateTimePicker({ 
  date, 
  onDateChange,
  className,
  placeholder = "MM/DD/YYYY hh:mm aa"
}) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [internalDate, setInternalDate] = React.useState(date)

  React.useEffect(() => {
    setInternalDate(date)
  }, [date])

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)

  const handleDateSelect = (selectedDate) => {
    if (selectedDate) {
      const newDate = internalDate ? new Date(internalDate) : new Date(selectedDate)
      newDate.setFullYear(selectedDate.getFullYear())
      newDate.setMonth(selectedDate.getMonth())
      newDate.setDate(selectedDate.getDate())
      setInternalDate(newDate)
      onDateChange?.(newDate)
    }
  }

  const handleTimeChange = (type, value) => {
    let newDate
    if (internalDate) {
      newDate = new Date(internalDate)
    } else {
      // If no date is selected, create a new date with today's date
      newDate = new Date()
    }

    if (type === "hour") {
      const hourValue = parseInt(value) // 1-12
      const currentHours = newDate.getHours()
      const isPM = currentHours >= 12
      // Convert 12-hour to 24-hour: 12 AM → 0, 12 PM → 12, 1-11 AM → 1-11, 1-11 PM → 13-23
      const hour24 = isPM ? (hourValue === 12 ? 12 : hourValue + 12) : (hourValue === 12 ? 0 : hourValue)
      newDate.setHours(hour24)
    } else if (type === "minute") {
      newDate.setMinutes(parseInt(value))
    } else if (type === "ampm") {
      const currentHours = newDate.getHours()
      const hour12 = currentHours % 12 || 12
      if (value === "PM") {
        newDate.setHours(hour12 === 12 ? 12 : hour12 + 12)
      } else {
        newDate.setHours(hour12 === 12 ? 0 : hour12)
      }
    }
    setInternalDate(newDate)
    onDateChange?.(newDate)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9 text-sm",
            !internalDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {internalDate ? (
            format(internalDate, "dd/MM/yyyy hh:mm aa")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 max-h-[calc(100vh-150px)] z-[10002]" 
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={24}
        avoidCollisions={true}
        onWheel={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={internalDate ?? undefined}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
            <div className="w-64 sm:w-20 h-[300px] overflow-y-auto overflow-x-hidden">
              <div className="flex sm:flex-col p-2 gap-1">
                {hours.reverse().map((hour) => {
                  const currentHour12 = internalDate ? (internalDate.getHours() % 12 || 12) : null
                  return (
                    <Button
                      type="button"
                      key={hour}
                      size="icon"
                      variant={
                        internalDate && currentHour12 === hour
                          ? "default"
                          : "ghost"
                      }
                      className="sm:w-full shrink-0 aspect-square h-10 w-10"
                      onClick={() => handleTimeChange("hour", hour.toString())}
                    >
                      {hour}
                    </Button>
                  )
                })}
              </div>
            </div>
            <div className="w-64 sm:w-20 h-[300px] overflow-y-auto overflow-x-hidden">
              <div className="flex sm:flex-col p-2 gap-1">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                  <Button
                    type="button"
                    key={minute}
                    size="icon"
                    variant={
                      internalDate && internalDate.getMinutes() === minute
                        ? "default"
                        : "ghost"
                    }
                    className="sm:w-full shrink-0 aspect-square h-10 w-10"
                    onClick={() =>
                      handleTimeChange("minute", minute.toString())
                    }
                  >
                    {minute.toString().padStart(2, '0')}
                  </Button>
                ))}
              </div>
            </div>
            <div className="w-64 sm:w-16 h-[300px] flex items-start">
              <div className="flex sm:flex-col p-2 gap-1 w-full">
                {["AM", "PM"].map((ampm) => (
                  <Button
                    type="button"
                    key={ampm}
                    size="icon"
                    variant={
                      internalDate &&
                      ((ampm === "AM" && internalDate.getHours() < 12) ||
                        (ampm === "PM" && internalDate.getHours() >= 12))
                        ? "default"
                        : "ghost"
                    }
                    className="sm:w-full shrink-0 aspect-square h-10 w-10"
                    onClick={() => handleTimeChange("ampm", ampm)}
                  >
                    {ampm}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

