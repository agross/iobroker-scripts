class Format {
  public static dateTime(val: Date): string {
    const format = Intl.DateTimeFormat('de', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    return format.format(new Date(val));
  }
}
