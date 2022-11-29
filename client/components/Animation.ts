import { fadeInVertical } from "../helpers/animations";
import { Flex } from "rebass/styled-components";
import styled from "styled-components";
import { prop } from "styled-tools";
import { FC } from "react";

interface Props extends React.ComponentProps<typeof Flex> {
  offset: string;
  duration?: string;
}

const Animation: FC<Props> = styled(Flex)<Props>`
  animation: ${(props) => fadeInVertical(props.offset)}
    ${prop("duration", "0.3s")} ease-out;
`;

export default Animation;
