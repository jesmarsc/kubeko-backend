const fs = require('fs');
const fsPromise = require('fs').promises;
const Busboy = require('busboy');

const saveAll = (req, res, next) => {
  res.locals.fields = {};
  res.locals.files = {};
  const busboy = new Busboy({ headers: req.headers });
  const writePromises = [];
  busboy.on('field', (fieldname, val) => {
    res.locals.fields[fieldname] = val;
  });
  busboy.on('file', (fieldname, file, filename) => {
    const filePath = path.join(__dirname, filename);
    const writeStream = file.pipe(fs.createWriteStream(filePath));

    res.locals.files[fieldname] = filePath;
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
};

const cleanupOnError = async (err, req, res, next) => {
  for (const filePath of Object.values(res.locals.files)) {
    await fsPromise.unlink(filePath);
  }
  next(err);
};

module.exports = {
  saveAll,
  cleanupOnError,
};
