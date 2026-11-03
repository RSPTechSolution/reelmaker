/** Error with an HTTP status; the app's error handler sends `{error: message}` with that status. */
export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}
