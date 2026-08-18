export class CameraLogger {
  public static log(event: string, details?: any) {
    const timestamp = new Date().toISOString();
    const detailsStr = details
      ? typeof details === 'object'
        ? JSON.stringify(details)
        : String(details)
      : '';
    console.log(`[${timestamp}] [CameraPipeline] [${event}] ${detailsStr}`);
  }
}
