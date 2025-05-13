// components/charts/SimpleBarChart.tsx
"use client"; // Gráficos precisam ser Client Components

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ChartDataPoint {
  name: string; // Especialidade ou outra categoria
  valor: number; // Quantidade ou valor
}

interface SimpleBarChartProps {
  data: ChartDataPoint[];
  title: string;
  description?: string;
  dataKey: string; // Chave para a barra (ex: "valor")
  fillColor?: string;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  title,
  description,
  dataKey,
  fillColor = "#3b82f6", // Azul padrão
}) => {
    // Retorna um estado vazio ou de erro se não houver dados
    if (!data || data.length === 0) {
         return (
             <Card>
                 <CardHeader>
                     <CardTitle className="text-base font-semibold">{title}</CardTitle>
                     {description && <CardDescription className="text-sm">{description}</CardDescription>}
                 </CardHeader>
                 <CardContent className="h-[250px] flex items-center justify-center"> {/* Altura fixa para consistência */}
                     <p className="text-sm text-gray-500">Sem dados para exibir o gráfico.</p>
                 </CardContent>
             </Card>
        );
    }

    // Calcula uma altura dinâmica simples para acomodar rótulos rotacionados se houver muitos itens
    const chartHeight = 250 + (data.length > 6 ? 30 : 0);

    return (
        <Card className="shadow-sm hover:shadow-md transition-shadow duration-200"> {/* Efeito hover adicionado */}
            <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-800">{title}</CardTitle> {/* Cor ajustada */}
                {description && <CardDescription className="text-sm text-gray-500">{description}</CardDescription>} {/* Cor ajustada */}
            </CardHeader>
            <CardContent className="pr-0 pl-1 sm:pl-0"> {/* Removido padding direito/esquerdo para mais espaço */}
                <ResponsiveContainer width="100%" height={chartHeight}>
                    {/* Ajustada margem inferior para rótulos rotacionados e esquerda para valores Y */}
                    <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="name"
                            stroke="#6b7280"
                            fontSize={11} // Fonte menor
                            tickLine={false}
                            axisLine={false}
                            angle={-45} // <-- Rótulos rotacionados
                            textAnchor="end" // <-- Alinhamento dos rótulos
                            interval={0} // <-- Exibe todos os rótulos
                            // height={60} // Pode precisar ajustar a altura se os nomes forem muito grandes
                        />
                        <YAxis
                            stroke="#6b7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false} // Para contagens inteiras
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.375rem', fontSize: '12px' }}
                            cursor={{ fill: '#f3f4f6' }}
                            // formatter={(value: number) => value.toString()} // Formata valor no tooltip se necessário
                        />
                        {/* <Legend /> // Desabilitado por padrão para limpar */}
                        <Bar dataKey={dataKey} fill={fillColor} radius={[4, 4, 0, 0]} name="Quantidade"/>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};