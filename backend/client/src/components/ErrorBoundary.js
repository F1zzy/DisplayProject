import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(this.props.label || 'ErrorBoundary', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary-fallback" role="alert">
          <p className="error-boundary-title">
            {this.props.title || 'Section unavailable'}
          </p>
          <p className="error-boundary-message">
            {this.props.message || 'Something went wrong. Other parts of the display keep running.'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
