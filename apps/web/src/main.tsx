import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Application root is missing');
}

createRoot(root).render(
  <StrictMode>
    <main className="bootstrap-shell">
      <strong>Knowledge OS</strong>
      <span>正在初始化工作台</span>
    </main>
  </StrictMode>,
);
