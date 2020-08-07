import React, { FC } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { useTheme } from "../../hooks";
interface Props {
  data: any[]; // TODO: types
}

const ChartBar: FC<Props> = ({ data }) => {
  const theme = useTheme()
  return (

    <ResponsiveContainer
      width="100%"
      height={window.innerWidth < 468 ? 240 : 320}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{
          top: 0,
          right: 0,
          left: 24,
          bottom: 0
        }}
      >
        <XAxis type="number" dataKey="value" />
        <YAxis type="category" dataKey="name" />
        <CartesianGrid strokeDasharray="1 1" />
        <Tooltip />
        <Bar dataKey="value" fill={theme.stats.map05} />
      </BarChart>
    </ResponsiveContainer>
  );
}
export default ChartBar;
