import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="state error" style={{ margin: '40px 28px' }}>
          <div>
            <h3>Une erreur est survenue</h3>
            <p>{this.state.error?.message || 'Erreur inconnue'}</p>
            <button className="btn" onClick={() => window.location.reload()}>
              Recharger la page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
