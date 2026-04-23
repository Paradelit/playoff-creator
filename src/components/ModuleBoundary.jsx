import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import logger from '../utils/logger';

export default class ModuleBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error(`ModuleBoundary [${this.props.name || 'unknown'}]`, error, {
      componentStack: errorInfo?.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-red-500" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Error en {this.props.name || 'este módulo'}</h2>
          <p className="text-sm text-slate-500 mb-5 max-w-xs">
            Ha ocurrido un error inesperado. El resto de la app sigue funcionando.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
          >
            <RotateCcw size={15} aria-hidden="true" /> Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
