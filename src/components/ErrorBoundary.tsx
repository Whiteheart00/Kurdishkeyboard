import React from 'react';
import { logEvent } from '../utils/activityLogger';

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Silent React ErrorBoundary.
 * Records real render crashes into local Activity Logs & Reports in the background
 * without displaying any automatic crash-report popup or technical dump.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const combinedStack = [error.stack, info.componentStack ? `Component Stack:${info.componentStack}` : '']
      .filter(Boolean)
      .join('\n\n');

    logEvent({
      category: 'CRASHES',
      severity: 'CRITICAL',
      title: 'Unhandled UI Render Crash',
      description: error.message || 'A fatal rendering exception occurred inside the React tree.',
      component: 'ReactErrorBoundary',
      operation: 'render_cycle',
      status: 'FAILED',
      errorMessage: error.message || error.name,
      stackTrace: combinedStack,
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen w-full bg-[#090B0F] text-white flex items-center justify-center p-6"
          dir="rtl"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#12151C] border border-white/10 p-6 text-center space-y-4">
            <h2 className="text-base font-extrabold">کێشەیەکی چاوەڕواننەکراو ڕوویدا</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              تکایە بەرنامەکە دووبارە بکەرەوە. داتاکانت پارێزراون.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
              }}
              className="w-full h-11 rounded-2xl bg-[#0B5FA8] hover:bg-[#0E70C4] text-white text-xs font-extrabold transition-colors"
            >
              دووبارە هەوڵدانەوە
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
