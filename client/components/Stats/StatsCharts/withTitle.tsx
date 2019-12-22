import React, { FC } from 'react';
import styled from 'styled-components';
import formatDate from 'date-fns/format';
import { Flex } from 'reflexbox/styled-components';

interface Props {
  data: number | any; // TODO: types
  period?: string;
  periodText?: string;
  title?: string;
  updatedAt: string;
}

const Title = styled.h3`
  margin-bottom: 12px;
  font-size: 24px;
  font-weight: 300;

  @media only screen and (max-width: 768px) {
    font-size: 18px;
  }
`;

const SubTitle = styled.span`
  margin-bottom: 32px;
  font-size: 13px;
  font-weight: 300;
  color: #aaa;

  @media only screen and (max-width: 768px) {
    font-size: 11px;
  }
`;

const Count = styled.span`
  font-weight: bold;
  border-bottom: 1px dotted #999;
`;

const withTitle = (ChartComponent: FC<any>) => {
  function WithTitle(props: Props) {
    return (
      <Flex
        flexGrow={1}
        flexShrink={1}
        flexBasis={['100%', '100%', '50%']}
        flexDirection="column"
      >
        <Title>
          {props.periodText && (
            <Count>{props.data.reduce((sum, view) => sum + view, 0)}</Count>
          )}
          {props.periodText
            ? ` tracked clicks in ${props.periodText}`
            : props.title}
          .
        </Title>
        {props.periodText && props.updatedAt && (
          <SubTitle>
            Last update in{' '}
            {formatDate(new Date(props.updatedAt), 'dddd, hh:mm aa')}.
          </SubTitle>
        )}
        <ChartComponent {...props} />
      </Flex>
    );
  }
  WithTitle.defaultProps = {
    title: '',
    periodText: '',
  };
  return WithTitle;
};

export default withTitle;
