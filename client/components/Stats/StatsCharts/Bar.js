import React from 'react';
import PropTypes from 'prop-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import withTitle from './withTitle';

const ChartBar = ({ data }) => (
  <ResponsiveContainer width="100%" height={window.innerWidth < 468 ? 240 : 320}>
    <BarChart
      data={data}
      layout="vertical"
      margin={{
        top: 0,
        right: 0,
        left: 24,
        bottom: 0,
      }}
    >
      <XAxis type="number" dataKey="value" />
      <YAxis type="category" dataKey="name" />
      <CartesianGrid strokeDasharray="1 1" />
      <Tooltip />
      <Bar dataKey="value" fill="#B39DDB" />
    </BarChart>
  </ResponsiveContainer>
);

ChartBar.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object.isRequired).isRequired,
};

export default withTitle(ChartBar);
