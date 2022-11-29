import { FC } from "react";
import { Box, BoxProps } from "rebass/styled-components";
import styled, { css } from "styled-components";
import { ifProp } from "styled-tools";
import Link from "next/link";

interface Props extends BoxProps {
  href?: string;
  title?: string;
  target?: string;
  rel?: string;
  forButton?: boolean;
  isNextLink?: boolean;
}
const StyledBox = styled(Box)<Props>`
  cursor: pointer;
  color: #2196f3;
  border-bottom: 1px dotted transparent;
  text-decoration: none;
  transition: all 0.2s ease-out;

  ${ifProp(
    { forButton: false },
    css`
      :hover {
        border-bottom-color: #2196f3;
      }
    `
  )}
`;

export const ALink: FC<Props> = (props) => {
  if (props.isNextLink) {
    const { href, target, title, rel, ...rest } = props;
    return (
      <Link href={href} target={target} title={title} rel={rel} passHref>
        <StyledBox as="a" {...rest} />
      </Link>
    );
  }
  return <StyledBox as="a" {...props} />;
};

ALink.displayName = "ALink";

ALink.defaultProps = {
  pb: "1px",
  forButton: false
};

export default ALink;
