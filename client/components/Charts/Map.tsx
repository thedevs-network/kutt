import styled from "styled-components";
import React, { FC } from "react";
// import { VectorMap } from "@south-paw/react-vector-maps";

import Tooltip from "../Tooltip";
import world from "./world.json";

const Svg = styled.svg`
  path {
    fill: ${({ theme }) => theme.stats.map0};
    stroke: #fff;
  }

  path.country-6 {
    fill: ${({ theme }) => theme.stats.map06};
    stroke: #fff;
  }
  path.country-5 {
    fill: ${({ theme }) => theme.stats.map05};
    stroke: #fff;
  }
  path.country-4 {
    fill: ${({ theme }) => theme.stats.map04};
    stroke: #fff;
  }
  path.country-3 {
    fill: ${({ theme }) => theme.stats.map03};
    stroke: #fff;
  }
  path.country-2 {
    fill: ${({ theme }) => theme.stats.map02};
    stroke: #fff;
  }
  path.country-1 {
    fill: ${({ theme }) => theme.stats.map01};
    stroke: #fff;
  }
`;

interface Props {
  data: Array<{ name: string; value: number }>;
}

const Map: FC<Props> = ({ data }) => {
  const [mostVisits] = data.sort((a, b) => (b.value - a.value > 0 ? 1 : -1));
  return (
    <>
      {world.layers.map(layer => (
        <Tooltip
          key={layer.id}
          type="light"
          effect="float"
          id={`${layer.id}-tooltip-country`}
        >
          {layer.name}:{" "}
          {data.find(d => d.name.toLowerCase() === layer.id)?.value || 0}
        </Tooltip>
      ))}
      <Svg
        xmlns="http://www.w3.org/2000/svg"
        aria-label="world map"
        viewBox={world.viewBox}
      >
        {world.layers.map(layer => (
          <path
            key={layer.id}
            data-tip
            data-for={`${layer.id}-tooltip-country`}
            className={`country-${Math.ceil(
              ((data.find(d => d.name.toLowerCase() === layer.id)?.value || 0) /
                mostVisits?.value || 0) * 6
            )}`}
            aria-label={layer.name}
            d={layer.d}
          />
        ))}
      </Svg>
    </>
  );
};

export default Map;
