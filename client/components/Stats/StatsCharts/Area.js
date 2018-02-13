import React from 'react';
import PropTypes from 'prop-types';
import subHours from 'date-fns/sub_hours';
import subDays from 'date-fns/sub_days';
import subMonths from 'date-fns/sub_months';
import formatDate from 'date-fns/format';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import withTitle from './withTitle';

const ChartArea = ({ data: rawData, period }) => {
  const now = new Date();
  const getDate = index => {
    switch (period) {
      case 'allTime':
        return formatDate(subMonths(now, rawData.length - index), 'MMM YY');
      case 'lastDay':
        return formatDate(subHours(now, rawData.length - index), 'HH:00');
      case 'lastMonth':
      case 'lastWeek':
      default:
        return formatDate(subDays(now, rawData.length - index), 'MMM DD');
    }
  };
  const data = rawData.map((view, index) => ({
    name: getDate(index),
    views: view,
  }));

  return (
    <ResponsiveContainer width="100%" height={window.innerWidth < 468 ? 240 : 320}>
      <AreaChart
        data={data}
        margin={{
          top: 16,
          right: 0,
          left: 0,
          bottom: 16,
        }}
      >
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#B39DDB" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#B39DDB" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" />
        <YAxis />
        <CartesianGrid strokeDasharray="1 1" />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="views"
          isAnimationActive={false}
          stroke="#B39DDB"
          fillOpacity={1}
          fill="url(#colorUv)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

ChartArea.propTypes = {
  data: PropTypes.arrayOf(PropTypes.number.isRequired).isRequired,
  period: PropTypes.string.isRequired,
};

export default withTitle(ChartArea);
