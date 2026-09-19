import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: boolean}> {
  state = {error: false};
  static getDerivedStateFromError() { return {error: true}; }
  render() { return this.state.error ? <main className="recovery"><h1>화면을 열지 못했어요</h1><p>기록을 지우지 않고 보존했습니다. 창을 다시 열어주세요. 문제가 계속되면 백업 파일을 보관한 뒤 확인해주세요.</p><button className="button" onClick={() => location.reload()}>다시 열기</button></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
