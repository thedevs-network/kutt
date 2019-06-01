import React, { Component } from 'react';
import styled from 'styled-components';
import axios from 'axios';
import BodyWrapper from '../components/BodyWrapper';
import { authUser } from '../actions';
import TextInput from '../components/TextInput';
import Button from '../components/Button';

const Wrapper = styled.div`
  width: 600px;
  max-width: 97%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const Form = styled.form`
  position: relative;
  display: flex;
`;

const Message = styled.p`
  position: absolute;
  left: 0;
  bottom: -54px;
  font-size: 14px;
  color: ${props => (props.type === 'error' ? 'red' : 'green')};

  @media only screen and (max-width: 448px) {
    bottom: -44px;
    font-size: 12px;
  }
`;

class ReportPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      message: {
        text: '',
        type: '',
      },
      url: '',
    };
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
  }

  onChange(e) {
    const url = e.target.value;
    this.setState({ url });
  }

  async onSubmit(e) {
    e.preventDefault();
    this.setState({ loading: true });
    try {
      await axios.post('/api/url/report', { url: this.state.url });
      this.setState({
        loading: false,
        message: {
          type: 'success',
          text: "Thanks for the report, we'll take actions shortly.",
        },
        url: '',
      });
    } catch (error) {
      this.setState({
        loading: false,
        message: {
          type: 'error',
          text: error.response.data.error,
        },
        url: '',
      });
    }

    setTimeout(() => {
      this.setState({
        message: {
          type: '',
          text: '',
        },
      });
    }, 5000);
  }

  render() {
    const { loading, message, url } = this.state;

    return (
      <BodyWrapper>
        <Wrapper>
          <h3>Report abuse</h3>
          <p>
            Report abuses, malware and phishing links to the below email address or use the form. We
            will take actions shortly.
          </p>
          <p>{(process.env.REPORT_EMAIL || '').replace('@', '[at]')}</p>
          <p>
            <b>URL containting malware/scam:</b>
          </p>
          <Form onSubmit={this.onSubmit}>
            <TextInput
              type="text"
              placeholder="kutt.it/example"
              value={url}
              onChange={this.onChange}
              height={44}
              small
            />
            <Button type="submit" icon={loading ? 'loader' : ''}>
              Send report
            </Button>
            <Message type={message.type}>{message.text}</Message>
          </Form>
        </Wrapper>
      </BodyWrapper>
    );
  }
}

ReportPage.getInitialProps = ({ req, reduxStore }) => {
  const token = req && req.cookies && req.cookies.token;
  if (token && reduxStore) reduxStore.dispatch(authUser(token));
  return {};
};

export default ReportPage;
