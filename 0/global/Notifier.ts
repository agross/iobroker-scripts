class Notifier {
  public static notify(message: string): void {
    sendTo('pushbullet', {
      message: message,
      title: 'ioBroker',
      type: 'note',
    });
  }
}
