import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import Router from 'next/router';
import styled from 'styled-components';
import axios from 'axios';
import cookie from 'js-cookie';
import StatsError from './StatsError';
import StatsHead from './StatsHead';
import StatsCharts from './StatsCharts';
import PageLoading from '../PageLoading';
import Button from '../Button';
import { showPageLoading } from '../../actions';

const Wrapper = styled.div`
  width: 1200px;
  max-width: 95%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin: 40px 0;
`;

const TitleWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h2`
  font-size: 24px;
  font-weight: 300;

  a {
    color: #2196f3;
    text-decoration: none;
    border-bottom: 1px dotted transparent;

    :hover {
      border-bottom-color: #2196f3;
    }
  }

  @media only screen and (max-width: 768px) {
    font-size: 18px;
  }
`;

const TitleTarget = styled.p`
  font-size: 14px;
  text-align: right;
  color: #333;

  @media only screen and (max-width: 768px) {
    font-size: 11px;
  }
`;

const Content = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 6px 30px rgba(50, 50, 50, 0.2);
`;

const ButtonWrapper = styled.div`
  align-self: center;
  margin: 64px 0;
`;

class Stats extends Component {
  constructor() {
    super();
    this.state = {
      error: false,
      loading: true,
      period: 'lastDay',
      stats: null,
    };
    this.changePeriod = this.changePeriod.bind(this);
    this.goToHomepage = this.goToHomepage.bind(this);
  }

  componentDidMount() {
    const { id } = this.props;
    if (!id) return null;
    return axios
      .get(`/api/url/stats?id=${id}`, { headers: { Authorization: cookie.get('token') } })
      .then(({ data }) =>
        this.setState({
          stats: data,
          loading: false,
          error: !data,
        })
      )
      .catch(() => this.setState({ error: true, loading: false }));
  }

  changePeriod(e) {
    e.preventDefault();
    const { period } = e.currentTarget.dataset;
    this.setState({ period });
  }

  goToHomepage(e) {
    e.preventDefault();
    this.props.showPageLoading();
    Router.push('/');
  }

  render() {
    const { error, loading, period, stats } = this.state;
    const { isAuthenticated, id } = this.props;

    if (!isAuthenticated) return <StatsError text="You need to login to view stats." />;

    if (!id || error) return <StatsError />;

    if (loading) return <PageLoading />;

    return (
      <Wrapper>
        <TitleWrapper>
          <Title>
            Stats for:{' '}
            <a href={stats.shortUrl} title="Short URL">
              {stats.shortUrl.replace(/https?:\/\//, '')}
            </a>
          </Title>
          <TitleTarget>
            {stats.target.length > 80
              ? `${stats.target
                  .split('')
                  .slice(0, 80)
                  .join('')}...`
              : stats.target}
          </TitleTarget>
        </TitleWrapper>
        <Content>
          <StatsHead total={stats.total} period={period} changePeriod={this.changePeriod} />
          <StatsCharts stats={stats[period]} updatedAt={stats.updatedAt} period={period} />
        </Content>
        <ButtonWrapper>
          <Button icon="arrow-left" onClick={this.goToHomepage}>
            Back to homepage
          </Button>
        </ButtonWrapper>
      </Wrapper>
    );
  }
}

Stats.propTypes = {
  isAuthenticated: PropTypes.bool.isRequired,
  id: PropTypes.string.isRequired,
  showPageLoading: PropTypes.func.isRequired,
};

const mapStateToProps = ({ auth: { isAuthenticated } }) => ({ isAuthenticated });

const mapDispatchToProps = dispatch => ({
  showPageLoading: bindActionCreators(showPageLoading, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(Stats);
