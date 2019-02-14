import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import formatDate from 'date-fns/format';

const Wrapper = styled.div`
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  align-items: stretch;

  @media only screen and (max-width: 768px) {
    flex-basis: 100%;
  }
`;

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

const withTitle = ChartComponent => {
  function WithTitle(props) {
    return (
      <Wrapper>
        <Title>
          {props.periodText && <Count>{props.data.reduce((sum, view) => sum + view, 0)}</Count>}
          {props.periodText ? ` clicks in ${props.periodText}` : props.title}.
        </Title>
        {props.periodText && props.updatedAt && (
          <SubTitle>Last update in {formatDate(props.updatedAt, 'dddd, hh:mm aa')}</SubTitle>
        )}
        <ChartComponent {...props} />
      </Wrapper>
    );
  }
  WithTitle.propTypes = {
    data: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.object])).isRequired,
    periodText: PropTypes.string,
    title: PropTypes.string,
    updatedAt: PropTypes.string.isRequired,
  };
  WithTitle.defaultProps = {
    title: '',
    periodText: '',
  };
  return WithTitle;
};

export default withTitle;
