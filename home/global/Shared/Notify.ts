class Notify {
  public static async tv(
    message: string,
    severity?: iobJS.LogLevel,
  ): Promise<void> {
    log(message, severity);

    await setStateAsync('lgtv.0.states.popup', message);
  }

  public static mobile(message: string, severity?: iobJS.LogLevel): void {
    log(message, severity);

    sendTo('telegram.0', { user: 'agross42', text: message });
  }
}
