export class CameraLogger {
  public static debug = false;
  public static log(event: string, details?: any) {
    if (!this.debug && !/ERROR|FAILURE|MOUNT|UNMOUNT|Recovery|Camera started|Camera stopped/i.test(event)) return;
    const timestamp = new Date().toISOString();
    const detailsStr = details
      ? typeof details === 'object'
        ? JSON.stringify(details)
        : String(details)
      : '';
    console.log(`[${timestamp}] [CameraPipeline] [${event}] ${detailsStr}`);
  }
}
