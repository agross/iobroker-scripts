class Notifier {
  public static notify(message: string, severity?: iobJS.LogLevel): void {
    log(message, severity);

    sendTo('pushbullet', {
      message: message,
      title: 'ioBroker',
      type: 'note',
    });
  }
}
