import React from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartWrapperProps {
  children: React.ReactNode;
  height?: number | string;
  width?: number | string;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({ 
  children, 
  height = 400, 
  width = '100%' 
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <ResponsiveContainer width={width} height={height}>
        {children}
      </ResponsiveContainer>
    </div>
  );
};