const express = require('express');
const fs = require('fs');
const fsPromise = require('fs').promises;
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
    res.locals.fields = {};
    res.locals.files = {};
    const busboy = new Busboy({ headers: req.headers });
    const writePromises = [];
    busboy.on('field', (fieldname, val) => {
      res.locals.fields[fieldname] = val;
    });
    busboy.on('file', (fieldname, file, filename) => {
      const filePath = path.join(__dirname, filename);
      res.locals.files[fieldname] = filePath;
      const writeStream = file.pipe(fs.createWriteStream(filePath));

      const writePromise = new Promise((resolve, reject) => {
        // When source stream emits end, it also calls end on the destination.
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      writePromises.push(writePromise);
    });
    busboy.on('finish', () => {
      Promise.all(writePromises)
        .then(() => next())
        .catch(next);
    });
    busboy.end(req.rawBody);
  },
  async (req, res, next) => {
    if (!res.locals.fields.ip) return next(new Error('Missing IP Address.'));
    if (Object.keys(res.locals.files).length === 0)
      return next(new Error('Missing File.'));

    const kubeClient = setupKubeClient(
      res.locals.fields.ip,
      req.headers.authorization.split(' ')[1]
    );

    const kubeCreate = {
      Deployment: kubeClient.apis.apps.v1.ns('default').deployments,
      Service: kubeClient.api.v1.ns('default').service,
    };

    try {
      for (const filePath of Object.values(res.locals.files)) {
        const fileData = await fsPromise.readFile(filePath, 'utf-8');
        const resources = yaml.safeLoadAll(fileData);
        for (const resource of resources) {
          await kubeCreate[resource.kind].post({ body: resource });
        }
        fsPromise.unlink(filePath);
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  (req, res) => {
    res.json({ msg: 'Successful deployment!' });
  },
  async (err, req, res, next) => {
    for (const filePath of Object.values(res.locals.files)) {
      await fsPromise.unlink(filePath);
    }
    next(err);
  },
  (err, req, res, next) => {
    statusCode = !!err.code && typeof err.code === 'number' ? err.code : 500;
    res.status(statusCode).json({ err: err.message });
  }
);

module.exports = router;
