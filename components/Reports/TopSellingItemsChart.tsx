import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartWrapper } from './ChartWrapper';

export interface TopSellingItem {
  name: string;
  quantity: number;
  percentage: number;
}

interface TopSellingItemsChartProps {
  data: TopSellingItem[];
  title?: string;
}

// Custom tooltip component for more detailed information
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-md rounded-lg">
        <p className="font-bold text-slate-800">{label}</p>
        <p className="text-sm text-slate-600">Quantity: {data.quantity}</p>
        <p className="text-sm text-slate-600">Percentage: {data.percentage}%</p>
      </div>
    );
  }
  return null;
};

export const TopSellingItemsChart: React.FC<TopSellingItemsChartProps> = ({ data, title = "Top Selling Items" }) => {
  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
      <ChartWrapper height={400}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar 
            dataKey="quantity" 
            fill="#10b981" 
            name="Quantity Sold"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartWrapper>
    </div>
  );
};