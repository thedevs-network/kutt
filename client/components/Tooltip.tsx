import ReactTooltip from "react-tooltip";
import styled from "styled-components";

const Tooltip = styled(ReactTooltip).attrs({
  effect: "solid"
})`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
`;

export default Tooltip;
