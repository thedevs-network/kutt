import ReactTooltip from "react-tooltip";
import styled from "styled-components";

const Tooltip = styled(ReactTooltip)`
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 11px;
`;

Tooltip.defaultProps = {
  effect: "solid"
};

export default Tooltip;
