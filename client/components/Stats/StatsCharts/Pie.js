import React from 'react';
import PropTypes from 'prop-types';
import { PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import withTitle from './withTitle';

const renderCustomLabel = ({ name }) => name;

const ChartPie = ({ data }) => (
  <ResponsiveContainer width="100%" height={window.innerWidth < 468 ? 240 : 320}>
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

ChartPie.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object.isRequired).isRequired,
};

export default withTitle(ChartPie);
