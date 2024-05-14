import 'zone.js/dist/zone-node';

import {ngExpressEngine} from '@nguniversal/express-engine';
import * as express from 'express';
import {join} from 'path';

import {AppServerModule} from './src/main.server';
import {APP_BASE_HREF} from '@angular/common';
import {existsSync} from 'fs';

// The Express app is exported so that it can be used by serverless Functions.
export function app() {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html')) ? 'index.original.html' : 'index';
  const axios = require('axios');

  // Our Universal express-engine (found @ https://github.com/angular/universal/tree/master/modules/express-engine)
  server.engine('html', ngExpressEngine({
    bootstrap: AppServerModule,
  }));

  server.set('view engine', 'html');
  server.set('views', distFolder);
  server.engine('html', require('hogan-express'));

  // TODO: implement data requests securely
  server.get('/api/**', (req, res) => {
    res.status(404).send('data requests are not yet supported');
  });

  // Serve static files from /browser
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Universal engine
  server.get('*', async (req, res) => {
    const response = await axios.get('https://opticae.online/api/ssr/index');
    const data = response.data.data;
    console.log(data);

    let facebookPixel = '';
    if (data?.facebookPixel) {
      facebookPixel = '<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?' +
        'n.callMethod.apply(n,arguments):n.queue.push(arguments)};' +
        'if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";' +
        'n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];' +
        's.parentNode.insertBefore(t,s)}(window, document,"script","https://connect.facebook.net/en_US/fbevents.js");' +
        'fbq("init","' + data.facebookPixel + '");fbq("track", "PageView");</script>';
    }

    let googleAnalytics = '';
    if (data?.googleAnalytics) {
      googleAnalytics = '<script async src="https://www.googletagmanager.com/gtag/js?id=' + data.googleAnalytics + '"></script>' +
        '<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}' +
        'gtag("js", new Date()); gtag("config", "' + data.googleAnalytics + '");</script>';
    }

    res.render(indexHtml, {
        req, providers: [
          {provide: APP_BASE_HREF, useValue: req.baseUrl}
        ],
      lang: data?.lang ? data.lang : 'en',
      title: data?.title,
      description: data?.description,
      keywords: data?.keywords,
      facebookPixel,
      googleAnalytics,
      }
    );
  });

  return server;
}

function run() {
  const port = process.env.PORT || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export * from './src/main.server';
