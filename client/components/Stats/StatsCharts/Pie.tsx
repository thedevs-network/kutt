import React, { FC } from 'react';
import { PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import withTitle from './withTitle';

interface Props {
  data: any[]; // TODO: types
}

const renderCustomLabel = ({ name }) => name;

const ChartPie: FC<Props> = ({ data }) => (
  <ResponsiveContainer
    width="100%"
    height={window.innerWidth < 468 ? 240 : 320}
  >
    <PieChart
      margin={{
        top: window.innerWidth < 468 ? 56 : 0,
        right: window.innerWidth < 468 ? 56 : 0,
        bottom: window.innerWidth < 468 ? 56 : 0,
        left: window.innerWidth < 468 ? 56 : 0,
      }}
    >
      <Pie
        data={data}
        dataKey="value"
        innerRadius={window.innerWidth < 468 ? 20 : 80}
        fill="#B39DDB"
        label={renderCustomLabel}
      />
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
);

export default withTitle(ChartPie);
