const fs = require('fs');
const os = require('os');
const path = require('path');
const Busboy = require('busboy');

const util = require('util');
const unlinkFilePromise = util.promisify(fs.unlink);

const saveAll = (req, res, next) => {
  res.locals.fields = {};
  res.locals.files = {};
  const busboy = new Busboy({ headers: req.headers });
  const writePromises = [];
  busboy.on('field', (fieldname, val) => {
    res.locals.fields[fieldname] = val;
  });
  busboy.on('file', (fieldname, file, filename) => {
    const filePath = path.join(os.tmpdir(), filename);
    const writeStream = file.pipe(fs.createWriteStream(filePath));

    res.locals.files[fieldname] = filePath;

    writePromises.push(
      new Promise((resolve, reject) => {
        // When source stream emits end, it also calls end on the destination.
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      })
    );
  });

  busboy.on('finish', () => {
    Promise.all(writePromises)
      .then(() => {
        if (!res.locals.fields.cid || Object.keys(res.locals.files).length < 1)
          throw new Error('Missing field or file entry.');
        next();
      })
      .catch(next);
  });
  busboy.end(req.rawBody);
};

const cleanupOnError = (err, req, res, next) => {
  for (const filePath of Object.values(res.locals.files)) {
    unlinkFilePromise(filePath).catch(next);
  }
  next(err);
};

module.exports = {
  saveAll,
  cleanupOnError,
};
