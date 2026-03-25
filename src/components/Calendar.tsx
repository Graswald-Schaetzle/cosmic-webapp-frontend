import * as React from 'react';
import { Calendar as CalendarComponent } from './ui/calendar';

interface CalendarProps {
  width?: string;
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
}

export function Calendar({ width = '240px', date, onDateChange }: CalendarProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date);
  const [month, setMonth] = React.useState<Date | undefined>(date);

  React.useEffect(() => {
    setSelectedDate(date);
    if (date) {
      setMonth(date);
    }
  }, [date]);

  const handleDateSelect = (newDate: Date | undefined) => {
    setSelectedDate(newDate);
    onDateChange?.(newDate);
  };

  return (
    <div style={{ width }} className="bg-slate-50 rounded-[20px]">
      <CalendarComponent
        mode="single"
        selected={selectedDate}
        onSelect={handleDateSelect}
        month={month}
        onMonthChange={setMonth}
        initialFocus
        className="rounded-md border-slate-800"
      />
    </div>
  );
}
