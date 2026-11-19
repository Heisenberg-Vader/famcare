import { Component } from 'react';
import { isChunkLoadError, reloadApp } from '../lib/appUpdate.js';
import { Button } from './Button.jsx';
import { Icon } from './Icon.jsx';

function Fallback({ error, fullScreen }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const chunk = isChunkLoadError(error);
  const [title, body] = offline
    ? ['You are offline', 'This part of CarePal needs a connection the first time it opens.']
    : chunk
      ? ['CarePal has been updated', 'Reload to get the latest version. Nothing you saved is lost.']
      : [
          'Something went wrong',
          'This part of the app could not be shown. Reloading usually fixes it.',
        ];
  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-6 text-center ${
        fullScreen ? 'mx-auto mt-16 max-w-sm' : ''
      }`}
    >
      <Icon name={chunk && !offline ? 'refresh' : 'warning'} size={28} className="text-brand-700" />
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{body}</p>
      </div>
      <Button onClick={() => reloadApp()}>
        <Icon name="refresh" size={18} />
        Reload
      </Button>
    </div>
  );
}

/**
 * Wraps lazily loaded parts of the app. If their code can't be downloaded (an old tab after a
 * deploy, or offline) or they throw while rendering, it shows a message with a Reload button
 * instead of a blank screen.
 */
export class LoadErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (!isChunkLoadError(error)) console.error(error);
  }

  render() {
    if (this.state.error) {
      return <Fallback error={this.state.error} fullScreen={this.props.fullScreen} />;
    }
    return this.props.children;
  }
}
