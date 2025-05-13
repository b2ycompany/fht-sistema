// components/charts/SimpleLineChart.tsx
"use client"; // Gráficos precisam ser Client Components

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils'; // Supondo que você tenha essa função ou importe de onde ela está

interface ChartDataPoint {
  name: string; // Mês ou Dia
  valor: number;
}

interface SimpleLineChartProps {
  data: ChartDataPoint[];
  title: string;
  description?: string;
  dataKey: string; // Chave para a linha (ex: "valor")
  strokeColor?: string;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({
  data,
  title,
  description,
  dataKey,
  strokeColor = "#3b82f6", // Azul padrão
}) => {
  if (!data || data.length === 0) {
    return (
         <Card>
             <CardHeader>
                 <CardTitle className="text-base font-semibold">{title}</CardTitle>
                 {description && <CardDescription className="text-sm">{description}</CardDescription>}
             </CardHeader>
             <CardContent className="h-[250px] flex items-center justify-center">
                <p className="text-sm text-gray-500">Sem dados para exibir.</p>
             </CardContent>
         </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}> {/* Ajustado Margens */}
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /> {/* Linhas de grade mais suaves */}
            <XAxis
              dataKey="name"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCurrency(value)} // Formata eixo Y como moeda
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.375rem', fontSize: '12px' }} // Estilo do Tooltip
              formatter={(value: number) => formatCurrency(value)} // Formata valor no tooltip
            />
            {/* <Legend /> // Legenda opcional */}
            <Line
              type="monotone"
              dataKey={dataKey} // Usar a chave passada por prop
              stroke={strokeColor}
              strokeWidth={2}
              activeDot={{ r: 6 }} // Ponto ativo maior
              dot={{ r: 3, fill: strokeColor }} // Pontos menores
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};