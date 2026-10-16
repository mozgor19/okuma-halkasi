export function bootstrapScript(appUrl: string): string {
  return `(() => {
    if (location.origin !== ${JSON.stringify(appUrl)} || window.top !== window) return;
    if (window.__okumaShell) {
      window.__okumaShell.report();
      window.dispatchEvent(new CustomEvent('okuma:native-ready'));
      return;
    }
    const post = value => window.ReactNativeWebView.postMessage(JSON.stringify(value));
    const overlays = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]';
    const overlayOpen = () => Array.from(document.querySelectorAll(overlays)).some(node => node.getClientRects().length);
    let scheduled = false;
    let previousOverlay;
    function report() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const root = document.documentElement;
        const css = getComputedStyle(root);
        const color = (role, fallback) => css.getPropertyValue(role).trim() || fallback;
        post({ type: 'shell:theme',
          background: color('--color-canvas', '#ffffff'),
          surface: color('--color-surface', '#ffffff'),
          text: color('--color-text', '#171717'),
          action: color('--color-action', '#171717'),
          dark: root.classList.contains('dark') });
        const open = overlayOpen();
        if (open !== previousOverlay) {
          previousOverlay = open;
          post({ type: 'shell:overlay', open });
        }
      });
    }
    function back(id, fallbackCanGoBack) {
      const overlay = overlayOpen();
      if (overlay) {
        (document.activeElement || document).dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
        }));
        post({ type: 'shell:back', id, handled: true });
        return;
      }
      const state = history.state && history.state.kitapTahlilNavigation;
      const canGoBack = state ? state.view !== 'home' && !state.guard : fallbackCanGoBack;
      if (canGoBack) history.back();
      post({ type: 'shell:back', id, handled: !!canGoBack });
    }
    window.__okumaShell = { report, back, fileStreaming: true, notifications: true };
    new MutationObserver(report).observe(document.documentElement, {
      attributes: true, attributeFilter: ['class', 'data-scheme', 'style']
    });
    new MutationObserver(report).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-state'], childList: true, subtree: true
    });
    window.addEventListener('load', report);
    document.addEventListener('DOMContentLoaded', report);
    window.addEventListener('okuma:resume', report);
    report();
    window.dispatchEvent(new CustomEvent('okuma:native-ready'));
  })(); true;`;
}

export function backScript(id: string, appUrl: string, canGoBack: boolean): string {
  return `if(location.origin===${JSON.stringify(appUrl)}) {
    if(window.__okumaShell) window.__okumaShell.back(${JSON.stringify(id)},${canGoBack});
    else window.ReactNativeWebView.postMessage(JSON.stringify({type:'shell:back',id:${JSON.stringify(id)},handled:false}));
  } true;`;
}

export function resumeScript(appUrl: string): string {
  return `if(location.origin===${JSON.stringify(appUrl)}) {
    window.dispatchEvent(new CustomEvent('okuma:resume'));
  } true;`;
}
