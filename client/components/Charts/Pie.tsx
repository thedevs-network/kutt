import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";
import React, { FC } from "react";
import { useTheme } from "../../hooks";

interface Props {
  data: any[]; // TODO: types
}

const ChartPie: FC<Props> = ({ data }) => {
  const theme = useTheme()
  return (

    <ResponsiveContainer
      width="100%"
      height={window.innerWidth < 468 ? 240 : 320}
    >
      <PieChart
        margin={{
          top: window.innerWidth < 468 ? 56 : 0,
          right: window.innerWidth < 468 ? 56 : 0,
          bottom: window.innerWidth < 468 ? 56 : 0,
          left: window.innerWidth < 468 ? 56 : 0
        }}
      >
        <Pie
          data={data}
          dataKey="value"
          innerRadius={window.innerWidth < 468 ? 20 : 80}
          fill={theme.stats.map05}
          label={({ name }) => name}
        />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
export default ChartPie;
