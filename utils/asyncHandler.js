const APIresponse = (res, message, statusCode, status, data) => {
  let respData = {
    message,
    statusCode,
    status,
    data,
  };
  res.status(statusCode || 200).send(respData);
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
