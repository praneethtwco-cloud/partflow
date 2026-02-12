import React, { useState } from 'react';
import { PresetDateRange, getPresetDateRange, formatDate, parseDate, isValidDateRange } from '../../utils/reports/dateUtils';

interface DateRangeSelectorProps {
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
  initialPreset?: PresetDateRange;
  initialStartDate?: Date;
  initialEndDate?: Date;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  onDateRangeChange,
  initialPreset = PresetDateRange.THIS_MONTH,
  initialStartDate,
  initialEndDate
}) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetDateRange>(initialPreset);
  const [customStartDate, setCustomStartDate] = useState<string>(
    initialStartDate ? formatDate(initialStartDate) : formatDate(getPresetDateRange(initialPreset).startDate)
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    initialEndDate ? formatDate(initialEndDate) : formatDate(getPresetDateRange(initialPreset).endDate)
  );
  const [isCustomRange, setIsCustomRange] = useState<boolean>(initialPreset === PresetDateRange.CUSTOM);

  // Apply initial date range
  React.useEffect(() => {
    if (initialPreset === PresetDateRange.CUSTOM && initialStartDate && initialEndDate) {
      setCustomStartDate(formatDate(initialStartDate));
      setCustomEndDate(formatDate(initialEndDate));
      onDateRangeChange(initialStartDate, initialEndDate);
    } else {
      const presetRange = getPresetDateRange(initialPreset);
      onDateRangeChange(presetRange.startDate, presetRange.endDate);
    }
  }, []);

  const handlePresetChange = (preset: PresetDateRange) => {
    if (preset === PresetDateRange.CUSTOM) {
      setIsCustomRange(true);
      // Use current custom dates if they're valid, otherwise use today
      const startDate = customStartDate ? parseDate(customStartDate) : new Date();
      const endDate = customEndDate ? parseDate(customEndDate) : new Date();
      onDateRangeChange(startDate, endDate);
    } else {
      setIsCustomRange(false);
      setSelectedPreset(preset);
      const presetRange = getPresetDateRange(preset);
      setCustomStartDate(formatDate(presetRange.startDate));
      setCustomEndDate(formatDate(presetRange.endDate));
      onDateRangeChange(presetRange.startDate, presetRange.endDate);
    }
  };

  const handleCustomDateChange = () => {
    const startDate = parseDate(customStartDate);
    const endDate = parseDate(customEndDate);
    
    if (isValidDateRange(startDate, endDate)) {
      onDateRangeChange(startDate, endDate);
    }
  };

  const presets = [
    { value: PresetDateRange.TODAY, label: 'Today' },
    { value: PresetDateRange.THIS_WEEK, label: 'This Week' },
    { value: PresetDateRange.THIS_MONTH, label: 'This Month' },
    { value: PresetDateRange.THIS_QUARTER, label: 'This Quarter' },
    { value: PresetDateRange.THIS_YEAR, label: 'This Year' },
    { value: PresetDateRange.CUSTOM, label: 'Custom Range' },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPreset === preset.value && !isCustomRange
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              onClick={() => handlePresetChange(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        {isCustomRange && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleCustomDateChange}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>
    </div>
  );
};