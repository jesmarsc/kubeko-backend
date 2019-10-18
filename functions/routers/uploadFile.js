const express = require('express');
const fs = require('fs').promises;
const yaml = require('js-yaml');
const path = require('path');
const Busboy = require('busboy');

const { KubeConfig } = require('kubernetes-client');
const Request = require('kubernetes-client/backends/request');
const Client = require('kubernetes-client').Client;

const router = express.Router();

const setupKubeClient = (ip, token) => {
  const kubeconfig = new KubeConfig();
  kubeconfig.loadFromClusterAndUser(
    {
      server: `https://${ip}`,
      skipTLSVerify: true,
    },
    {
      token,
    }
  );

  return new Client({
    backend: new Request({ kubeconfig }),
    version: '1.13',
  });
};

router.post(
  '/',
  (req, res, next) => {
    const busboy = new Busboy({ headers: req.headers });
    busboy.on(
      'field',
      (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimtype) => {
        console.log(val);
      }
    );
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      console.log(filename);
      file.resume();
    });
    busboy.on('finish', () => {
      next();
    });
    busboy.end(req.rawBody);
  },
  (req, res) => {
    res.json({ msg: 'Successful deployment!' });
  },
  (err, req, res, next) => {
    statusCode = !!err.code ? err.code : 500;
    res.status(statusCode).json({ status: statusCode, msg: err.message });
  }
);

module.exports = router;
