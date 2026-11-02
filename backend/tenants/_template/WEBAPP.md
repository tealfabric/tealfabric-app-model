# app-model WebApp Definition

Create this webapp in the TealFabric platform to load the App Model Vite + React SPA from the CDN **while keeping the webapp URL visible** (no redirect).

## How It Works

1. User visits the webapp URL (e.g. `https://dev.tealfabric.io/app-model`)
2. The webapp page loads and fetches the app HTML from the CDN
3. The React app (HTML, CSS, JS) is injected into the page
4. All JS/CSS assets load from the CDN (via Vite `base`)
5. The URL stays as the webapp URL; navigation happens client-side
6. **No RSC fetches** – pure client-side routing, no server requests during navigation

## Authentication

Users are **regular platform users** (`role: user`). They authenticate via the BFF (`auth_login` verifies platform credentials, then issues a WebApp JWT). The SPA sends `Authorization: Bearer` on protected actions; the router validates `process_input.auth`.

Do **not** embed API keys in CDN JavaScript.

## WebApp Details

| Field | Value |
|-------|-------|
| **Name** | app-model |
| **Description** | App Model reference app — full-featured prototype leveraging ProcessFlow, DataPool, integrations, and storage. |
| **Public URI path** | `/app-model` (recommended for SPA routing) |
| **Process** | `app-model-router` (action-based BFF) |

## Page Content (HTML)

```html
<div id="app-model-root" style="min-height:100vh;">
  <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <div style="width:32px;height:32px;border:2px solid #0d9488;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
  </div>
</div>
<style>@keyframes spin{to{transform:rotate(360deg)}}</style>
```

## Custom JavaScript

```javascript
(function() {
  var CDN = 'https://cdn.tealfabric.io/t/TENANT_ID/app-model';
  var root = document.getElementById('app-model-root');
  function toCdnUrl(url) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return CDN.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
  }
  fetch(CDN + '/index.html', { mode: 'cors' })
    .then(function(r) { return r.text(); })
    .then(function(html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      [].forEach.call(doc.head.querySelectorAll('link, script'), function(n) {
        if (n.tagName === 'SCRIPT') {
          var s = document.createElement('script');
          var rawSrc = n.getAttribute('src');
          if (rawSrc) {
            s.src = toCdnUrl(rawSrc);
            if (n.async) s.async = true;
            if (n.defer) s.defer = true;
            for (var i = 0; i < n.attributes.length; i++) {
              var a = n.attributes[i];
              if (a.name !== 'src') s.setAttribute(a.name, a.value || '');
            }
          } else {
            s.textContent = n.textContent;
          }
          document.head.appendChild(s);
        } else {
          var rawHref = n.getAttribute('href');
          if (rawHref) n.setAttribute('href', toCdnUrl(rawHref));
          document.head.appendChild(n);
        }
      });
      var bodyNodes = [];
      [].forEach.call(doc.body.childNodes, function(node) {
        if (node.nodeType === 1 && node.tagName === 'SCRIPT') {
          var s = document.createElement('script');
          var bodyRawSrc = node.getAttribute('src');
          if (bodyRawSrc) {
            s.src = toCdnUrl(bodyRawSrc);
            if (node.async) s.async = true;
            if (node.defer) s.defer = true;
            if (node.id) s.id = node.id;
            for (var i = 0; i < node.attributes.length; i++) {
              var a = node.attributes[i];
              if (a.name !== 'src') s.setAttribute(a.name, a.value || '');
            }
          } else {
            s.textContent = node.textContent;
          }
          bodyNodes.push(s);
        } else {
          bodyNodes.push(node);
        }
      });
      document.body.replaceChildren.apply(document.body, bodyNodes);
    })
    .catch(function() {
      var err = document.createElement('div');
      err.textContent = 'Failed to load app. ';
      var a = document.createElement('a');
      a.href = CDN + '/';
      a.textContent = 'Open directly';
      err.appendChild(a);
      root.replaceChildren(err);
    });
})();
```

## CDN URL

```
https://cdn.tealfabric.io/t/TENANT_ID/app-model/
```

Replace `TENANT_ID` with your tenant UUID when deploying.

## CSP (`custom_security_policy`)

Required for any shell WebApp that loads SPA HTML/JS/CSS from tenant CDN. Without it, browsers block the CDN fetch under `default-src 'self'` (`connect-src` / `script-src` / `style-src`).

Minimum (add same-origin API / BFF hosts to `connect-src` when the SPA calls the platform):

```text
default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tealfabric.io; style-src 'self' 'unsafe-inline' https://cdn.tealfabric.io; font-src 'self' data: https://cdn.tealfabric.io; img-src 'self' data: https:; connect-src 'self' https://cdn.tealfabric.io;
```

Set this on create/update via deploy script or platform API, then **publish** the WebApp. The `tealfabric-app-model` deploy script sets `custom_security_policy` automatically via `buildShellSecurityPolicy`.

## Build Configuration

- `base`: `./` so asset URLs are relative and can be rewritten to CDN by the webapp loader
- React Router `basename`: `/app-model` so routes align with the webapp URL

## SPA Routing

Set **Public URI path** to `/app-model` so that:

- `https://dev.tealfabric.io/app-model` → home
- `https://dev.tealfabric.io/app-model/items` → items
- etc.

The Tealfabric router should serve the webapp for all paths under `/app-model` (prefix match) so client-side navigation works on refresh.
