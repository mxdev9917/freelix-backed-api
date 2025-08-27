// utils/errors.js
exports.pathError = (req, res, next) => {
  const err = new Error(`Path ${req.originalUrl} not found on the server`);
  err.statusCode = 404;
  next(err);
};

exports.apiError = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({
    status: statusCode,
    message,
  });
};

exports.mapError = (status, msg, next) => {
  const error = new Error(msg);
  error.statusCode = status;
  next(error);
};