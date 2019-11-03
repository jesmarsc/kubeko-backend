const express = require('express');
const cors = require('cors');
const proxy = require('http-proxy-middleware');
const k8sWare = require('./middleware/k8s');

const app = express();

app.use(cors({ origin: true }));

app.use(
  '/clusters/:cid',
  k8sWare.getCluster,
  proxy({
    target: 'https://localhost',
    router: req => `https://${req.addr}`,
    pathRewrite: { '^/kubeko/us-central1/proxy/clusters/[^/]+': '' },
    changeOrigin: true,
    logLevel: 'silent'
  }),
  (err, req, res, next) => {
    res.json({ status: 'Failure', message: err.message, code: res.statusCode });
  }
);

module.exports = app;
