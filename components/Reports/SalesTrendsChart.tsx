import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartWrapper } from './ChartWrapper';

export interface SalesTrendDataPoint {
  date: string;
  sales: number;
  transactions: number;
  grossSales: number;
  netSales: number;
}

interface SalesTrendsChartProps {
  data: SalesTrendDataPoint[];
  title?: string;
  showGrossSales?: boolean;
  showNetSales?: boolean;
  showTransactions?: boolean;
}

// Custom tooltip component for more detailed information
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-md rounded-lg">
        <p className="font-bold text-slate-800">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? `₹${entry.value.toLocaleString()}` : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const SalesTrendsChart: React.FC<SalesTrendsChartProps> = ({ 
  data, 
  title = "Sales Trends", 
  showGrossSales = true,
  showNetSales = true,
  showTransactions = true
}) => {
  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
      <ChartWrapper height={400}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => `₹${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {showGrossSales && (
            <Line 
              type="monotone" 
              dataKey="grossSales" 
              name="Gross Sales" 
              stroke="#ef4444" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }} 
            />
          )}
          {showNetSales && (
            <Line 
              type="monotone" 
              dataKey="netSales" 
              name="Net Sales" 
              stroke="#4f46e5" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }} 
            />
          )}
          {showTransactions && (
            <Line 
              type="monotone" 
              dataKey="transactions" 
              name="Transactions" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }} 
              yAxisId="right"
            />
          )}
        </LineChart>
      </ChartWrapper>
    </div>
  );
};