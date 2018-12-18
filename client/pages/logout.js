import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { logoutUser } from '../actions';

class LogoutPage extends Component {
  componentDidMount() {
    this.props.logoutUser();
  }
  render() {
    return <div />;
  }
}

LogoutPage.propTypes = {
  logoutUser: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({ logoutUser: bindActionCreators(logoutUser, dispatch) });

export default connect(null, mapDispatchToProps)(LogoutPage);
