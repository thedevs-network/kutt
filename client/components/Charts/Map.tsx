import styled from "styled-components";
import React from "react";
// import { VectorMap } from "@south-paw/react-vector-maps";

import { Colors } from "../../consts";
import Tooltip from "../Tooltip";
import world from "./world.json";

const Svg = styled.svg`
  path {
    fill: ${Colors.Map0};
    stroke: #fff;
  }

  path.country-6 {
    fill: ${Colors.Map06};
    stroke: #fff;
  }
  path.country-5 {
    fill: ${Colors.Map05};
    stroke: #fff;
  }
  path.country-4 {
    fill: ${Colors.Map04};
    stroke: #fff;
  }
  path.country-3 {
    fill: ${Colors.Map03};
    stroke: #fff;
  }
  path.country-2 {
    fill: ${Colors.Map02};
    stroke: #fff;
  }
  path.country-1 {
    fill: ${Colors.Map01};
    stroke: #fff;
  }
`;

interface Props {
  data: Array<{ name: string; value: number }>;
}

const Map = ({ data }) => {
  const [mostVisits] = data.sort((a, b) => (a > b ? 1 : -1));
  return (
    <>
      {world.layers.map(layer => (
        <>
          <Tooltip
            type="light"
            effect="float"
            id={`${layer.id}-tooltip-country`}
          >
            {layer.name}:{" "}
            {data.find(d => d.name.toLowerCase() === layer.id)?.value || 0}
          </Tooltip>
        </>
      ))}
      <Svg
        xmlns="http://www.w3.org/2000/svg"
        aria-label="world map"
        viewBox={world.viewBox}
      >
        {world.layers.map(layer => (
          <>
            <path
              data-tip
              data-for={`${layer.id}-tooltip-country`}
              className={`country-${Math.ceil(
                ((data.find(d => d.name.toLowerCase() === layer.id)?.value ||
                  0) / mostVisits?.value || 0) * 6
              )}`}
              key={layer.id}
              aria-label={layer.name}
              d={layer.d}
            />
          </>
        ))}
      </Svg>
    </>
  );
};

export default Map;
