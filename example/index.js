#!/usr/bin/env node
'use strict';

const
  path = require('path'),
  logger = require('morgan'),
  express = require('express'),
  bodyParser = require('body-parser'),
  favicon = require('serve-favicon'),
  helmet = require('helmet'),
  app = express();

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

app.use(helmet());
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'none'"],
    connectSrc: ["'none'"],
    imgSrc: ["'self'", 'data:'],
    fontSrc: ["'self'"],
    styleSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
    scriptSrc: ["'none'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    manifestSrc: ["'none'"],
    mediaSrc: ["'none'"],
    prefetchSrc: ["'none'"],
    workerSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'none'"],
    requireSriFor: ['script', 'style'],
    sandbox: true,
    upgradeInsecureRequests: (process.env.NODE_ENV === 'production'),
    blockAllMixedContent: (process.env.NODE_ENV === 'production'),
    reportUri: '/report-violation'
  }
}));

app.use((req, res, next) => {
  var csp = res.get('Content-Security-Policy');
  res.set('Content-Security-Policy', `${csp}; disown-opener`);
  res.set('Tk', 'N');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('X-Permitted-Cross-Domain-Policies', 'none');
  next();
});

app.use(bodyParser.json({
  type: ['json', 'application/csp-report']
}));

app.post('/report-violation', function (req, res) {
  (req.body) ? console.log('CSP Violation: ', req.body) : console.log('CSP Violation: No data received!');
  res.status(204).end();
});

app.use(favicon(path.join(__dirname, 'favicon.ico')));
app.use(logger(function (tokens, req, res) {
  return [
    req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ].join(' ');
}, {
  skip: function (req, res) {
    return ([301, 302].indexOf(res.statusCode) >= 0) || (process.env.NODE_ENV === 'production' && (!req.headers['x-forwarded-for']));
  }
}));

if (process.env.NODE_ENV === 'production') {
  app.use(function ensureSecure (req, res, next) {
    if ((!req.secure) && (req.get('X-Forwarded-Proto') !== 'https') && req.headers['x-forwarded-for']) {
      return res.redirect('https://' + req.hostname + req.url);
    };
    return next();
  });
}

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = (process.env.NODE_ENV === 'local') ? err : {};
  res.status(err.status || 500).send();
});

app.listen('3000');
