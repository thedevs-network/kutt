import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Router from 'next/router';
import styled from 'styled-components';
import URL from 'url';
import TBodyButton from './TBodyButton';
import { showPageLoading } from '../../../actions';

const Wrapper = styled.div`
  display: flex;
  flex: 1 1 auto;
  justify-content: space-between;
  align-items: center;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;

  button {
    margin: 0 2px 0 12px;
  }
`;

const Icon = styled.img`
  width: 12px;
  height: 12px;
`;

class TBodyCount extends Component {
  constructor() {
    super();
    this.goTo = this.goTo.bind(this);
  }

  goTo(e) {
    e.preventDefault();
    this.props.showLoading();
    const host = URL.parse(this.props.url.shortUrl).hostname;
    Router.push(`/stats?id=${this.props.url.id}${`&domain=${host}`}`);
  }

  render() {
    const { showModal, url } = this.props;
    return (
      <Wrapper>
        {url.count || 0}
        <Actions>
          {url.password && <Icon src="/images/lock.svg" lowopacity />}
          {url.count > 0 && (
            <TBodyButton withText onClick={this.goTo}>
              <Icon src="/images/chart.svg" />
              Stats
            </TBodyButton>
          )}
          <TBodyButton
            data-id={url.id}
            data-host={URL.parse(url.shortUrl).hostname}
            onClick={showModal}
          >
            <Icon src="/images/trash.svg" />
          </TBodyButton>
        </Actions>
      </Wrapper>
    );
  }
}

TBodyCount.propTypes = {
  showLoading: PropTypes.func.isRequired,
  showModal: PropTypes.func.isRequired,
  url: PropTypes.shape({
    count: PropTypes.number,
    id: PropTypes.string,
    password: PropTypes.bool,
    shortUrl: PropTypes.string,
  }).isRequired,
};

const mapDispatchToProps = dispatch => ({
  showLoading: bindActionCreators(showPageLoading, dispatch),
});

export default connect(null, mapDispatchToProps)(TBodyCount);
