import ReactTooltip from "react-tooltip";
import styled from "styled-components";

const Tooltip = styled(ReactTooltip).attrs({
  effect: "solid"
})`
  padding: 3px 7px;
  border-radius: 4px;
  font-size: 11px;
`;

export default Tooltip;
