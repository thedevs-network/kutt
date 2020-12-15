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

interface Props {
  data: any[]; // TODO: types
}

const ChartBar: FC<Props> = ({ data }) => (
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
      {/* Todo
          Need to come up with a better way to use css variables here.
          A bit tricky since we can't use className or css props here
      */}
      <XAxis type="number" dataKey="value" stroke="var(--color-text)" />
      <YAxis type="category" dataKey="name" stroke="var(--color-text)" />
      <CartesianGrid strokeDasharray="1 1" />
      <Tooltip
        itemStyle={{ color: "var(--color-text)" }}
        contentStyle={{
          borderRadius: "4px",
          backgroundColor: "var(--color-modal-bg)",
          borderColor: "var(--default-border-color)"
        }}
        cursor={{ fill: "rgba(190,189,189,0.4)" }}
      />
      <Bar dataKey="value" fill="#B39DDB" />
    </BarChart>
  </ResponsiveContainer>
);

export default ChartBar;
